<?php

namespace Tests\Feature;

use App\Models\TemplateSertif;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BulkCertificateGenerationTest extends TestCase
{
    use RefreshDatabase;

    public function test_bulk_generation_dispatches_batch()
    {
        Bus::fake();
        Storage::fake('public');

        $user = User::factory()->create(['role' => 'admin']);
        $template = TemplateSertif::factory()->create([
            'signed_template_path' => 'templates/signed_test.pdf'
        ]);
        
        // Create a dummy signed PDF
        Storage::disk('public')->put('templates/signed_test.pdf', '%PDF-1.4 dummy content');

        // Create a fake Excel file
        // We can't easily create a real Excel file in test without a library, 
        // but we can mock the Excel facade or just rely on the controller validation passing
        // and then mocking the Excel::toArray call if possible.
        // However, since we are testing the controller which calls Excel::toArray, 
        // we might need a real file or mock the facade.
        
        // Let's try to mock Excel facade
        \Maatwebsite\Excel\Facades\Excel::shouldReceive('toArray')
            ->once()
            ->andReturn([
                [
                    ['Nomor', 'Email'], // Header
                    ['SERT-001', 'test1@example.com'],
                    ['SERT-002', 'test2@example.com'],
                ]
            ]);

        $file = UploadedFile::fake()->create('recipients.xlsx');

        $response = $this->actingAs($user)
            ->post(route('certificates.generate-from-excel'), [
                'templateSertifId' => $template->id,
                'excel_file' => $file,
                'passphrase' => 'secret'
            ]);

        $response->assertRedirect();
        // Check if redirected to progress page
        // The URL should contain 'certificates/bulk/progress/'
        $this->assertStringContainsString('certificates/bulk/progress/', $response->headers->get('Location'));

        Bus::assertBatched(function ($batch) use ($template) {
            return $batch->name == 'Bulk Certificate Generation - ' . $template->title &&
                   $batch->jobs->count() === 2;
        });
    }
}
