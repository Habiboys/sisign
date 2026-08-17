<?php

namespace Tests\Feature;

use App\Models\Review;
use App\Models\Signature;
use App\Models\TemplateSertif;
use App\Models\TemplateSigner;
use App\Models\User;
use App\Services\EncryptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use TCPDF;
use Tests\TestCase;

class TemplateSignatureDeletionTest extends TestCase
{
    use RefreshDatabase;

    private function createSignedTemplate(User $signer1, User $signer2): TemplateSertif
    {
        $encryptionService = app(EncryptionService::class);
        $encryptionService->generateKeyPair($signer1, 'passphrase1');
        $encryptionService->generateKeyPair($signer2, 'passphrase2');

        $template = TemplateSertif::create([
            'title' => 'Test Template',
            'files' => 'template.pdf',
            'reviewId' => Review::create(['status' => 'approved'])->id,
        ]);

        TemplateSigner::create(['template_id' => $template->id, 'user_id' => $signer1->id, 'sign_order' => 1]);
        TemplateSigner::create(['template_id' => $template->id, 'user_id' => $signer2->id, 'sign_order' => 2]);

        $pdfDir = storage_path('app/public/templates');
        if (! is_dir($pdfDir)) {
            mkdir($pdfDir, 0755, true);
        }
        $pdf = new TCPDF;
        $pdf->AddPage();
        $pdf->Write(0, 'Mock template content');
        $pdf->Output($pdfDir.'/template.pdf', 'F');

        return $template;
    }

    private function fakeSignedPdfBase64(): string
    {
        $pdf = new TCPDF;
        $pdf->AddPage();
        $pdf->Write(0, 'Mock signed content');

        return base64_encode($pdf->Output('', 'S'));
    }

    public function test_signer_can_delete_own_template_signature()
    {
        Storage::fake('public');

        $signer1 = User::factory()->create(['role' => 'pimpinan']);
        $signer2 = User::factory()->create(['role' => 'pimpinan']);
        $template = $this->createSignedTemplate($signer1, $signer2);

        $this->actingAs($signer1)->post(route('templates.sign', $template), [
            'signatureData' => 'data:image/png;base64,mocksignature',
            'passphrase' => 'passphrase1',
            'signedPdfBase64' => $this->fakeSignedPdfBase64(),
            'position' => ['x' => 10, 'y' => 10, 'width' => 100, 'height' => 50, 'page' => 1],
        ])->assertRedirect(route('templates.show', $template->id));

        $this->assertTrue($template->signers()->where('user_id', $signer1->id)->first()->is_signed);

        $response = $this->actingAs($signer1)->delete(route('templates.remove-signature', $template));

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $this->assertSame(0, Signature::where('templateSertifId', $template->id)->where('userId', $signer1->id)->count());
        $this->assertFalse($template->signers()->where('user_id', $signer1->id)->first()->is_signed);
    }

    public function test_template_signature_deletion_is_blocked_once_fully_signed()
    {
        Storage::fake('public');

        $signer1 = User::factory()->create(['role' => 'pimpinan']);
        $signer2 = User::factory()->create(['role' => 'pimpinan']);
        $template = $this->createSignedTemplate($signer1, $signer2);

        $this->actingAs($signer1)->post(route('templates.sign', $template), [
            'signatureData' => 'data:image/png;base64,mocksignature',
            'passphrase' => 'passphrase1',
            'signedPdfBase64' => $this->fakeSignedPdfBase64(),
            'position' => ['x' => 10, 'y' => 10, 'width' => 100, 'height' => 50, 'page' => 1],
        ])->assertRedirect(route('templates.show', $template->id));

        $this->actingAs($signer2)->post(route('templates.sign', $template), [
            'signatureData' => 'data:image/png;base64,mocksignature',
            'passphrase' => 'passphrase2',
            'signedPdfBase64' => $this->fakeSignedPdfBase64(),
            'position' => ['x' => 10, 'y' => 60, 'width' => 100, 'height' => 50, 'page' => 1],
        ])->assertRedirect(route('templates.show', $template->id));

        $this->assertTrue($template->fresh()->isCompleted());

        $response = $this->actingAs($signer1)->delete(route('templates.remove-signature', $template));

        $response->assertRedirect();
        $response->assertSessionHas('error');

        $this->assertSame(2, Signature::where('templateSertifId', $template->id)->where('userId', $signer1->id)->count());
        $this->assertTrue($template->signers()->where('user_id', $signer1->id)->first()->is_signed);
    }
}
