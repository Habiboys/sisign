<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\DocumentSigner;
use App\Models\Review;
use App\Models\Signature;
use App\Models\User;
use App\Services\EncryptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SignatureDeletionTest extends TestCase
{
    use RefreshDatabase;

    private function createSignedDocument(User $signer1, User $signer2): Document
    {
        $encryptionService = app(EncryptionService::class);
        $encryptionService->generateKeyPair($signer1, '123456');
        $encryptionService->generateKeyPair($signer2, '123456');
        $signer1->update(['pin' => bcrypt('123456')]);
        $signer2->update(['pin' => bcrypt('123456')]);

        $document = Document::create([
            'userId' => User::factory()->create()->id,
            'title' => 'Test Document',
            'files' => 'test.pdf',
            'number' => '123',
            'to' => $signer1->id,
            'reviewId' => Review::create(['status' => 'approved'])->id,
        ]);

        DocumentSigner::create(['document_id' => $document->id, 'user_id' => $signer1->id, 'sign_order' => 1]);
        DocumentSigner::create(['document_id' => $document->id, 'user_id' => $signer2->id, 'sign_order' => 2]);

        $pdfDir = storage_path('app/public/documents');
        if (! is_dir($pdfDir)) {
            mkdir($pdfDir, 0755, true);
        }
        file_put_contents($pdfDir.'/test.pdf', '%PDF-1.4 mock content');

        return $document;
    }

    public function test_user_can_delete_own_physical_and_digital_signature_together()
    {
        Storage::fake('public');

        $signer1 = User::factory()->create(['role' => 'pimpinan']);
        $signer2 = User::factory()->create(['role' => 'pimpinan']);
        $document = $this->createSignedDocument($signer1, $signer2);

        $this->actingAs($signer1)->post(route('signatures.digital', $document), [
            'pin' => '123456',
            'position' => ['x' => 10, 'y' => 10, 'width' => 100, 'height' => 50, 'page' => 1],
        ])->assertSuccessful();

        $this->assertSame(1, Signature::where('documentId', $document->id)->where('userId', $signer1->id)->count());
        $this->assertTrue($document->signers()->where('user_id', $signer1->id)->first()->is_signed);

        $response = $this->actingAs($signer1)->delete(route('signatures.destroy', $document));

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $this->assertSame(0, Signature::where('documentId', $document->id)->where('userId', $signer1->id)->count());
        $this->assertFalse($document->signers()->where('user_id', $signer1->id)->first()->is_signed);
    }

    public function test_signature_deletion_is_blocked_once_document_fully_signed()
    {
        Storage::fake('public');

        $signer1 = User::factory()->create(['role' => 'pimpinan']);
        $signer2 = User::factory()->create(['role' => 'pimpinan']);
        $document = $this->createSignedDocument($signer1, $signer2);

        $this->actingAs($signer1)->post(route('signatures.digital', $document), [
            'pin' => '123456',
            'position' => ['x' => 10, 'y' => 10, 'width' => 100, 'height' => 50, 'page' => 1],
        ])->assertSuccessful();

        $this->actingAs($signer2)->post(route('signatures.digital', $document), [
            'pin' => '123456',
            'position' => ['x' => 10, 'y' => 60, 'width' => 100, 'height' => 50, 'page' => 1],
        ])->assertSuccessful();

        $this->assertTrue($document->fresh()->isCompleted());

        $response = $this->actingAs($signer1)->delete(route('signatures.destroy', $document));

        $response->assertRedirect();
        $response->assertSessionHasErrors('error');

        $this->assertSame(1, Signature::where('documentId', $document->id)->where('userId', $signer1->id)->count());
        $this->assertTrue($document->signers()->where('user_id', $signer1->id)->first()->is_signed);
    }

    public function test_user_cannot_delete_signature_they_never_created()
    {
        Storage::fake('public');

        $signer1 = User::factory()->create(['role' => 'pimpinan']);
        $signer2 = User::factory()->create(['role' => 'pimpinan']);
        $document = $this->createSignedDocument($signer1, $signer2);

        $response = $this->actingAs($signer1)->delete(route('signatures.destroy', $document));

        $response->assertRedirect();
        $response->assertSessionHasErrors('error');
    }
}
