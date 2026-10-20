<?php

namespace Tests\Feature;

use App\Jobs\SendSingleCertificateEmailJob;
use App\Mail\CertificateEmail;
use App\Models\Sertifikat;
use App\Models\User;
use Illuminate\Bus\PendingBatch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class CertificateEmailDeliveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_custom_message_is_passed_to_the_email_batch(): void
    {
        Bus::fake();
        $user = User::factory()->create(['role' => 'admin']);
        $certificate = Sertifikat::factory()->create();

        $this->actingAs($user)->post(route('certificates.sendEmails'), [
            'sertifikat_ids' => [$certificate->id],
            'email_subject' => 'Sertifikat kegiatan',
            'email_message' => "Terima kasih.\nSilakan unduh lampiran.",
        ])->assertRedirect();

        Bus::assertBatched(function (PendingBatch $batch): bool {
            $job = $batch->jobs->first();

            return $batch->queue() === 'emails'
                && $batch->allowsFailures()
                && $job instanceof SendSingleCertificateEmailJob
                && $job->emailSubject === 'Sertifikat kegiatan'
                && $job->emailMessage === "Terima kasih.\nSilakan unduh lampiran.";
        });
    }

    public function test_empty_content_uses_the_default_message_and_template_subject(): void
    {
        $certificate = Sertifikat::factory()->create();
        $mail = new CertificateEmail($certificate, null, $certificate->templateSertif, __FILE__);

        $mail->assertSeeInHtml(CertificateEmail::DEFAULT_MESSAGE);
        $mail->assertHasSubject('Sertifikat Digital - '.$certificate->templateSertif->title);
    }

    public function test_custom_message_is_escaped_and_pdf_remains_attached(): void
    {
        $certificate = Sertifikat::factory()->create();
        $mail = new CertificateEmail($certificate, null, $certificate->templateSertif, __FILE__, 'Judul khusus', '<script>alert(1)</script>');

        $mail->assertSeeInHtml('&lt;script&gt;alert(1)&lt;/script&gt;', false);
        $mail->assertDontSeeInHtml('<script>', false);
        $mail->assertHasSubject('Judul khusus');
        $mail->assertHasAttachment(__FILE__, [
            'as' => 'Sertifikat_'.$certificate->nomor_sertif.'.pdf',
            'mime' => 'application/pdf',
        ]);
    }

    public function test_email_renders_a_simple_layout_with_readable_custom_paragraphs(): void
    {
        $certificate = Sertifikat::factory()->create();
        $mail = new CertificateEmail($certificate, null, $certificate->templateSertif, __FILE__, null, "Terima kasih atas partisipasi Anda.\n\nSertifikat terlampir.\nSalam, Panitia");
        $html = $mail->render();

        $this->assertStringContainsString('<html lang="id">', $html);
        $this->assertStringContainsString('Sertifikat Anda', $html);
        $this->assertStringContainsString('Yth. Bapak/Ibu,', $html);
        $this->assertStringContainsString(e($certificate->nomor_sertif), $html);
        $this->assertStringContainsString('Sertifikat terlampir.<br />', $html);
        $this->assertStringContainsString('role="presentation"', $html);
        $this->assertStringNotContainsString('linear-gradient', $html);
        $this->assertStringNotContainsString('display: flex', $html);
    }

    public function test_invalid_content_is_rejected_before_dispatch(): void
    {
        Bus::fake();
        $user = User::factory()->create(['role' => 'admin']);
        $certificate = Sertifikat::factory()->create();

        $this->actingAs($user)->post(route('certificates.sendEmails'), [
            'sertifikat_ids' => [$certificate->id],
            'email_subject' => "Subject\r\nBcc: other@example.com",
            'email_message' => str_repeat('a', 10001),
        ])->assertSessionHasErrors(['email_subject', 'email_message']);

        Bus::assertNothingBatched();
    }

    public function test_pengaju_cannot_send_certificate_emails(): void
    {
        Bus::fake();
        $user = User::factory()->create(['role' => 'pengaju']);
        $this->actingAs($user)->post(route('certificates.sendEmails'), [])->assertForbidden();
        Bus::assertNothingBatched();
    }

    public function test_job_sends_custom_email_and_records_success(): void
    {
        Mail::fake();
        $certificate = Sertifikat::factory()->create();
        $path = storage_path('app/'.$certificate->file_path);
        File::ensureDirectoryExists(dirname($path));
        File::put($path, '%PDF-1.4 test');

        try {
            $job = new SendSingleCertificateEmailJob($certificate->id, 1, 'Judul', 'Pesan khusus');
            $job->handle();
            Mail::assertSent(CertificateEmail::class, fn (CertificateEmail $mail): bool => $mail->hasTo($certificate->email)
                && $mail->emailSubject === 'Judul' && $mail->emailMessage === 'Pesan khusus');
            $this->assertSame('sent', $certificate->fresh()->email_sent_status);
            $this->assertNotNull($certificate->fresh()->email_sent_at);
        } finally {
            File::delete($path);
        }
    }

    public function test_missing_attachment_records_failure_without_sending(): void
    {
        Mail::fake();
        $certificate = Sertifikat::factory()->create();

        try {
            (new SendSingleCertificateEmailJob($certificate->id, 1))->handle();
            $this->fail('Missing attachment should throw an exception.');
        } catch (\Exception $exception) {
            $this->assertStringContainsString('PDF file not found', $exception->getMessage());
        }

        $this->assertSame('failed', $certificate->fresh()->email_sent_status);
        Mail::assertNothingSent();
    }

    public function test_docker_worker_listens_to_the_email_queue(): void
    {
        $this->assertStringContainsString('--queue=emails,default', File::get(base_path('docker/supervisord.conf')));
        $this->assertLessThan(config('queue.connections.database.retry_after'), (new SendSingleCertificateEmailJob('certificate', 1))->timeout);
        $this->assertSame(30, config('mail.mailers.smtp.timeout'));
    }

    public function test_failed_batch_reaches_a_terminal_progress_state(): void
    {
        Queue::fake();
        $user = User::factory()->create(['role' => 'admin']);
        $batch = Bus::batch([new SendSingleCertificateEmailJob('missing', $user->id)])
            ->allowFailures()->onQueue('emails')->dispatch();
        $batch->recordFailedJob('failed-job', new \RuntimeException('SMTP unavailable'));

        $this->actingAs($user)->getJson(route('certificates.emailBatchStatus', $batch->id))
            ->assertOk()->assertJsonPath('finished', true)
            ->assertJsonPath('processedJobs', 1)->assertJsonPath('failedJobs', 1)
            ->assertJsonPath('progress', 100);
    }
}
