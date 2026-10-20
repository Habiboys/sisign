<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\DocumentSigner;
use App\Models\Review;
use App\Models\User;
use App\Services\EncryptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MultiSignatureTest extends TestCase
{
    use RefreshDatabase;

    public function test_document_can_have_multiple_signers()
    {
        Storage::fake('public');

        $user = User::factory()->create(['role' => 'pengaju']);
        $signer1 = User::factory()->create(['role' => 'pimpinan']);
        $signer2 = User::factory()->create(['role' => 'pimpinan']);

        $file = UploadedFile::fake()->create('document.pdf', 100);

        $response = $this->actingAs($user)->post(route('documents.store'), [
            'title' => 'Test Document',
            'number' => '123/TEST/2025',
            'file' => $file,
            'to' => [$signer1->id, $signer2->id],
        ]);

        $response->assertRedirect(route('documents.index'));

        $document = Document::first();
        $this->assertCount(2, $document->signers);
        $this->assertEquals($signer1->id, $document->signers[0]->user_id);
        $this->assertEquals($signer2->id, $document->signers[1]->user_id);
        $this->assertFalse($document->isCompleted());
    }

    public function test_barcode_generated_only_after_all_signers_signed()
    {
        Storage::fake('public');

        // Setup users and keys
        $signer1 = User::factory()->create(['role' => 'pimpinan']);
        $signer2 = User::factory()->create(['role' => 'pimpinan']);

        // Generate keys for signers (passphrase must match their PIN, which the
        // frontend sends as `pin` to storeDigital).
        $encryptionService = app(EncryptionService::class);
        $encryptionService->generateKeyPair($signer1, '123456');
        $encryptionService->generateKeyPair($signer2, '123456');
        $signer1->update(['pin' => bcrypt('123456')]);
        $signer2->update(['pin' => bcrypt('123456')]);

        // Create document
        $document = Document::create([
            'userId' => User::factory()->create()->id,
            'title' => 'Test Document',
            'files' => 'test.pdf',
            'number' => '123',
            'to' => $signer1->id, // Legacy field
            'reviewId' => Review::create(['status' => 'approved'])->id,
        ]);

        // Create signers
        DocumentSigner::create(['document_id' => $document->id, 'user_id' => $signer1->id]);
        DocumentSigner::create(['document_id' => $document->id, 'user_id' => $signer2->id]);

        // Mock PDF file
        // NB: createDocumentHash() reads storage_path('app/public/...') directly
        // (not the Storage disk facade), so the file must exist at the real path,
        // not only on the faked disk.
        $pdfDir = storage_path('app/public/documents');
        if (! is_dir($pdfDir)) {
            mkdir($pdfDir, 0755, true);
        }
        file_put_contents($pdfDir.'/test.pdf', '%PDF-1.4 mock content');

        // Signer 1 signs
        $response = $this->actingAs($signer1)->post(route('signatures.digital', $document), [
            'pin' => '123456',
            'position' => ['x' => 10, 'y' => 10, 'width' => 100, 'height' => 50, 'page' => 1],
        ]);

        $response->assertSuccessful();
        $this->assertTrue($document->signers()->where('user_id', $signer1->id)->first()->is_signed);
        $this->assertFalse($document->fresh()->isCompleted());

        // Signer 2 signs
        $this->actingAs($signer2)->post(route('signatures.digital', $document), [
            'pin' => '123456',
            'position' => ['x' => 10, 'y' => 60, 'width' => 100, 'height' => 50, 'page' => 1],
        ]);

        $this->assertTrue($document->signers()->where('user_id', $signer2->id)->first()->is_signed);
        $this->assertTrue($document->fresh()->isCompleted());
    }

    public function test_signature_fails_with_wrong_passphrase()
    {
        Storage::fake('public');

        $signer = User::factory()->create(['role' => 'pimpinan', 'pin' => bcrypt('123456')]);
        $encryptionService = app(EncryptionService::class);
        $encryptionService->generateKeyPair($signer, '123456');

        $document = Document::create([
            'userId' => User::factory()->create()->id,
            'title' => 'Test Document',
            'files' => 'test.pdf',
            'number' => '123',
            'to' => $signer->id,
            'reviewId' => Review::create(['status' => 'approved'])->id,
        ]);

        DocumentSigner::create(['document_id' => $document->id, 'user_id' => $signer->id]);
        $pdfDir = storage_path('app/public/documents');
        if (! is_dir($pdfDir)) {
            mkdir($pdfDir, 0755, true);
        }
        file_put_contents($pdfDir.'/test.pdf', '%PDF-1.4 mock content');

        $response = $this->actingAs($signer)->postJson(route('signatures.digital', $document), [
            'pin' => '000000',
            'position' => ['x' => 10, 'y' => 10, 'width' => 100, 'height' => 50, 'page' => 1],
        ]);

        $response->assertStatus(403);
        $response->assertJsonFragment(['success' => false]);
        $this->assertSame('PIN salah', $response->json('message'));
    }
}
