<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sertifikat Digital</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; color: #27272a; font-family: Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
            <td align="center" style="padding: 32px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; text-align: left;">
                    <tr>
                        <td style="padding-bottom: 24px; border-bottom: 1px solid #e4e4e7; color: #52525b; font-size: 13px; line-height: 20px;">
                            {{ config('mail.from.name') ?: config('app.name') }}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 28px 0 24px;">
                            <h1 style="margin: 0 0 8px; color: #18181b; font-size: 26px; line-height: 34px; font-weight: 600;">Sertifikat Anda</h1>
                            <p style="margin: 0; color: #71717a; font-size: 15px; line-height: 24px; overflow-wrap: anywhere;">{{ $template->title ?? 'Sertifikat Digital' }}</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="font-size: 15px; line-height: 25px;">
                            <p style="margin: 0 0 20px;">{{ $recipient ? 'Yth. '.$recipient->name.',' : 'Yth. Bapak/Ibu,' }}</p>
                            @foreach (preg_split('/\R{2,}/u', $emailMessage) as $paragraph)
                                <p style="margin: 0 0 20px; overflow-wrap: anywhere;">{!! nl2br(e($paragraph)) !!}</p>
                            @endforeach
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0 24px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid #e4e4e7; border-bottom: 1px solid #e4e4e7; font-size: 13px; line-height: 21px;">
                                <tr>
                                    <td style="padding: 16px 16px 4px 0; color: #71717a; width: 140px; vertical-align: top;">Nomor sertifikat</td>
                                    <td style="padding: 16px 0 4px; color: #27272a; overflow-wrap: anywhere;">{{ $sertifikat->nomor_sertif }}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 4px 16px 16px 0; color: #71717a; vertical-align: top;">Tanggal terbit</td>
                                    <td style="padding: 4px 0 16px; color: #27272a;">{{ $sertifikat->created_at->locale('id')->translatedFormat('d F Y') }}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="color: #71717a; font-size: 12px; line-height: 20px;">
                            Email ini dikirim otomatis. Hubungi pengirim jika ada data yang perlu diperbaiki.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
