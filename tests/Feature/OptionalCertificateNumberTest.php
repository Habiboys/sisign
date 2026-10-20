<?php

namespace Tests\Feature;

use App\Models\Sertifikat;
use App\Models\TemplateSertif;
use App\Models\User;
use App\Services\CertificateService;
use App\Services\ExcelTemplateService;
use App\Services\TemplateExcelExport;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

class OptionalCertificateNumberTest extends TestCase
{
    use RefreshDatabase;

    public function test_missing_blank_and_whitespace_numbers_are_generated_uniquely(): void
    {
        $template = TemplateSertif::factory()->create();
        $numbers = [];
        foreach ([null, '', '   '] as $number) {
            $certificate = Sertifikat::create(['templateSertifId' => $template->id, 'nomor_sertif' => $number]);
            $this->assertMatchesRegularExpression('/^CERT-[0-9A-Z]{26}$/', $certificate->nomor_sertif);
            $numbers[] = $certificate->nomor_sertif;
        }
        $missing = Sertifikat::create(['templateSertifId' => $template->id]);
        $numbers[] = $missing->nomor_sertif;
        $this->assertCount(4, array_unique($numbers));
    }

    public function test_manual_number_is_preserved(): void
    {
        $certificate = Sertifikat::factory()->create(['nomor_sertif' => 'MANUAL-001']);
        $this->assertSame('MANUAL-001', $certificate->fresh()->nomor_sertif);
    }

    public function test_missing_number_column_keeps_mapped_values_aligned(): void
    {
        $variables = [['name' => 'nama_lengkap'], ['name' => 'nomor_sertif'], ['name' => 'email']];
        $row = app(ExcelTemplateService::class)->normalizeCertificateNumberColumn(['Nama Lengkap', 'Email'], ['Nouval', 'nouval@example.com'], $variables);
        $this->assertSame(['Nouval', null, 'nouval@example.com'], $row);
    }

    public function test_existing_number_column_is_preserved(): void
    {
        $row = ['MANUAL-001', 'nouval@example.com'];
        $this->assertSame($row, app(ExcelTemplateService::class)->normalizeCertificateNumberColumn(['Nomor Sertifikat', 'Email'], $row, []));
    }

    public function test_manual_generation_request_accepts_an_omitted_number(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $recipient = User::factory()->create();
        $template = TemplateSertif::factory()->create();
        $service = \Mockery::mock(CertificateService::class);
        $service->shouldReceive('generateBulkCertificates')->once()->andReturn(['success_count' => 1, 'errors' => []]);
        $this->app->instance(CertificateService::class, $service);

        $this->actingAs($user)->post(route('certificates.generate-bulk'), [
            'templateSertifId' => $template->id,
            'recipients' => [['userId' => $recipient->id]],
        ])->assertSessionHasNoErrors()->assertSessionMissing('error')->assertRedirect();
    }

    public function test_legacy_excel_import_accepts_a_file_without_a_number_column(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $recipient = User::factory()->create();
        $template = TemplateSertif::factory()->create();
        Excel::shouldReceive('toArray')->once()->andReturn([[['Email'], [$recipient->email]]]);

        $this->actingAs($admin)->post(route('certificates.bulk.store'), [
            'templateSertifId' => $template->id,
            'excel_file' => UploadedFile::fake()->create('recipients.xlsx'),
        ])->assertSessionHasNoErrors()->assertRedirect();
        $certificate = Sertifikat::where('templateSertifId', $template->id)->sole();
        $this->assertStringStartsWith('CERT-', $certificate->nomor_sertif);
        $this->assertSame($recipient->id, $certificate->certificateRecipients->sole()->userId);
    }

    public function test_excel_template_leaves_number_examples_blank(): void
    {
        app(ExcelTemplateService::class);
        foreach ([[], [['name' => 'nomor_sertif'], ['name' => 'email']]] as $variables) {
            $template = TemplateSertif::factory()->make(['variable_positions' => $variables]);
            $export = new TemplateExcelExport($template);
            foreach ($export->array() as $row) {
                $this->assertSame('', $row[0]);
            }
        }
    }

    public function test_pdf_generation_uses_an_automatic_number_when_the_cell_is_blank(): void
    {
        Storage::fake('public');
        $pdf = new \TCPDF;
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);
        $pdf->AddPage();
        $pdf->Text(10, 10, 'Certificate');
        Storage::disk('public')->put('templates/optional-number.pdf', $pdf->Output('', 'S'));
        $template = TemplateSertif::factory()->create([
            'signed_template_path' => Storage::disk('public')->path('templates/optional-number.pdf'),
            'variable_positions' => [['name' => 'nomor_sertif', 'x' => 20, 'y' => 30], ['name' => 'email', 'x' => 20, 'y' => 50]],
        ]);

        app(CertificateService::class)->processSingleExcelRow($template, ['', 'nouval@example.com'], null, false);
        $certificate = Sertifikat::where('templateSertifId', $template->id)->sole();
        $path = storage_path('app/'.$certificate->file_path);
        try {
            $this->assertStringStartsWith('CERT-', $certificate->nomor_sertif);
            $this->assertSame('nouval@example.com', $certificate->email);
            $this->assertFileExists($path);
            $this->assertNotEmpty($certificate->content_hash);
        } finally {
            File::delete($path);
        }
    }

    public function test_excel_generation_accepts_a_removed_number_column_and_mapped_email(): void
    {
        Storage::fake('public');
        $pdf = new \TCPDF;
        $pdf->setPrintHeader(false);
        $pdf->AddPage();
        Storage::disk('public')->put('templates/no-number.pdf', $pdf->Output('', 'S'));
        $template = TemplateSertif::factory()->create([
            'signed_template_path' => Storage::disk('public')->path('templates/no-number.pdf'),
            'variable_positions' => [['name' => 'email', 'x' => 20, 'y' => 30]],
        ]);
        $user = User::factory()->create(['role' => 'admin']);
        Excel::shouldReceive('toArray')->once()->andReturn([[['Email'], ['nouval@example.com']]]);

        $this->actingAs($user)->post(route('certificates.generate-from-excel'), [
            'templateSertifId' => $template->id,
            'excel_file' => UploadedFile::fake()->create('recipients.xlsx'),
            'show_qr_code' => false,
        ])->assertSessionHasNoErrors()->assertSessionMissing('error')->assertRedirect();

        $certificate = Sertifikat::where('templateSertifId', $template->id)->sole();
        try {
            $this->assertSame('nouval@example.com', $certificate->email);
            $this->assertStringStartsWith('CERT-', $certificate->nomor_sertif);
            $this->assertFileExists(storage_path('app/'.$certificate->file_path));
        } finally {
            File::delete(storage_path('app/'.$certificate->file_path));
        }
    }
}
