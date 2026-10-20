<?php

namespace App\Mail;

use App\Models\Sertifikat;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class CertificateEmail extends Mailable
{
    use Queueable, SerializesModels;

    public const DEFAULT_MESSAGE = "Anda telah menerima sertifikat digital.\n\nSertifikat digital Anda terlampir dalam email ini. File PDF dapat Anda unduh dan simpan untuk keperluan verifikasi atau pencetakan.\n\nJika Anda memiliki pertanyaan atau memerlukan bantuan, silakan hubungi administrator sistem.";

    public Sertifikat $sertifikat;

    public ?User $recipient;

    public $template;

    public string $certificatePath;

    public string $recipientName;

    public string $recipientEmail;

    /**
     * Create a new message instance.
     */
    public function __construct(Sertifikat $sertifikat, ?User $recipient, $template, string $certificatePath, public ?string $emailSubject = null, public ?string $emailMessage = null)
    {
        $this->sertifikat = $sertifikat;
        $this->recipient = $recipient;
        $this->template = $template;
        $this->certificatePath = $certificatePath;
        $this->emailMessage = $emailMessage ?: self::DEFAULT_MESSAGE;

        // Set recipient name and email
        if ($recipient) {
            $this->recipientName = $recipient->name;
            $this->recipientEmail = $recipient->email;
        } else {
            // Use email from sertifikat and try to extract name
            $this->recipientEmail = $sertifikat->email ?? 'Penerima';
            $this->recipientName = 'Penerima Sertifikat'; // Default name
        }
    }

    /**
     * Build the message.
     */
    public function build(): static
    {
        return $this->subject($this->emailSubject ?: 'Sertifikat Digital - '.($this->template->title ?? 'Sertifikat'))
            ->view('emails.certificate')
            ->with([
                'sertifikat' => $this->sertifikat,
                'recipient' => $this->recipient,
                'recipientName' => $this->recipientName,
                'recipientEmail' => $this->recipientEmail,
                'template' => $this->template,
                'emailMessage' => $this->emailMessage ?: self::DEFAULT_MESSAGE,
            ])
            ->attach($this->certificatePath, [
                'as' => 'Sertifikat_'.$this->sertifikat->nomor_sertif.'.pdf',
                'mime' => 'application/pdf',
            ]);
    }
}
