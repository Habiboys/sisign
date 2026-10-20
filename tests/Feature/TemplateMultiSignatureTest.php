<?php

namespace Tests\Feature;

use App\Models\Review;
use App\Models\TemplateSertif;
use App\Models\TemplateSigner;
use App\Models\User;
use App\Services\EncryptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use TCPDF;
use Tests\TestCase;

class TemplateMultiSignatureTest extends TestCase
{
    use RefreshDatabase;

    public function test_template_can_have_multiple_signers()
    {
        Storage::fake('public');

        $user = User::factory()->create(['role' => 'pengaju']);
        $signer1 = User::factory()->create(['role' => 'pimpinan']);
        $signer2 = User::factory()->create(['role' => 'pimpinan']);

        $file = UploadedFile::fake()->create('template.pdf', 100);

        $response = $this->actingAs($user)->post(route('templates.store'), [
            'title' => 'Test Template',
            'description' => 'Description',
            'file' => $file,
            'signers' => [$signer1->id, $signer2->id],
        ]);

        $response->assertRedirect(route('templates.index'));

        $template = TemplateSertif::first();
        $this->assertCount(2, $template->signers);
        $this->assertEquals($signer1->id, $template->signers[0]->user_id);
        $this->assertEquals($signer2->id, $template->signers[1]->user_id);
        $this->assertFalse($template->isCompleted());
    }

    public function test_template_signing_flow()
    {
        Storage::fake('public');

        // Setup users and keys
        $signer1 = User::factory()->create(['role' => 'pimpinan']);
        $signer2 = User::factory()->create(['role' => 'pimpinan']);

        // Generate keys for signers
        $encryptionService = app(EncryptionService::class);
        $encryptionService->generateKeyPair($signer1, 'passphrase1');
        $encryptionService->generateKeyPair($signer2, 'passphrase2');

        // Create template
        $template = TemplateSertif::create([
            'title' => 'Test Template',
            'files' => 'template.pdf',
            'reviewId' => Review::create(['status' => 'approved'])->id,
        ]);

        // Create signers
        TemplateSigner::create(['template_id' => $template->id, 'user_id' => $signer1->id]);
        TemplateSigner::create(['template_id' => $template->id, 'user_id' => $signer2->id]);

        // Mock PDF file
        // NB: CertificateService::signTemplate() (the fallback path used when no
        // signedPdfBase64 is sent) reads storage_path('app/public/...') directly
        // (not the Storage disk facade) and parses it with FPDI, which requires
        // a structurally valid PDF (not just bytes starting with "%PDF-"), so we
        // generate a real one-page PDF with TCPDF instead of writing raw bytes.
        $pdfDir = storage_path('app/public/templates');
        if (! is_dir($pdfDir)) {
            mkdir($pdfDir, 0755, true);
        }
        $pdf = new TCPDF;
        $pdf->AddPage();
        $pdf->Write(0, 'Mock template content');
        $pdf->Output($pdfDir.'/template.pdf', 'F');

        // Signer 1 signs
        $response = $this->actingAs($signer1)->post(route('templates.sign', $template), [
            'signatureData' => 'data:image/png;base64,mocksignature',
            'passphrase' => 'passphrase1',
            'position' => ['x' => 10, 'y' => 10, 'width' => 100, 'height' => 50, 'page' => 1],
        ]);

        $response->assertRedirect(route('templates.show', $template->id));
        $this->assertTrue($template->signers()->where('user_id', $signer1->id)->first()->is_signed);
        $this->assertFalse($template->fresh()->isCompleted());

        // Signer 2 signs
        $response = $this->actingAs($signer2)->post(route('templates.sign', $template), [
            'signatureData' => 'data:image/png;base64,mocksignature',
            'passphrase' => 'passphrase2',
            'position' => ['x' => 10, 'y' => 60, 'width' => 100, 'height' => 50, 'page' => 1],
        ]);

        $response->assertRedirect(route('templates.show', $template->id));
        $this->assertTrue($template->signers()->where('user_id', $signer2->id)->first()->is_signed);
        $this->assertTrue($template->fresh()->isCompleted());
    }
}
