<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sertifikat Digital</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
        }

        .content {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 0 0 10px 10px;
        }

        .certificate-info {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #667eea;
        }

        .info-row {
            display: flex;
            margin: 10px 0;
        }

        .info-label {
            font-weight: bold;
            width: 150px;
            color: #555;
        }

        .info-value {
            flex: 1;
            color: #333;
        }

        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 14px;
        }

        .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }

        .button:hover {
            background: #5a6fd8;
        }
    </style>
</head>

<body>
    <div class="header">
        <h1>Sertifikat Digital</h1>
        <p>{{ $template->title }}</p>
    </div>

    <div class="content">
        <h2>Selamat {{ $recipientName ?? ($recipient->name ?? 'Penerima') }}!</h2>

        <p>Anda telah menerima sertifikat digital dengan detail sebagai berikut:</p>

        <div class="certificate-info">
            <div class="info-row">
                <div class="info-label">Nomor Sertifikat:</div>
                <div class="info-value">{{ $sertifikat->nomor_sertif }}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Nama Penerima:</div>
                <div class="info-value">{{ $recipientName ?? ($recipient->name ?? 'Penerima Sertifikat') }}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Email:</div>
                <div class="info-value">{{ $recipientEmail ?? ($recipient->email ?? $sertifikat->email ?? 'N/A') }}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Tanggal Terbit:</div>
                <div class="info-value">{{ $sertifikat->created_at->format('d F Y') }}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Template:</div>
                <div class="info-value">{{ $template->title }}</div>
            </div>
        </div>

        <p><strong>Sertifikat digital Anda terlampir dalam email ini.</strong> File PDF dapat Anda download dan simpan untuk keperluan verifikasi atau pencetakan.</p>

        <p>Jika Anda memiliki pertanyaan atau memerlukan bantuan, silakan hubungi administrator sistem.</p>

        <div class="footer">
            <p>Email ini dikirim secara otomatis oleh sistem SiSign Digital Certificate</p>
            <p>© {{ date('Y') }} SiSign - Digital Certificate Management System</p>
        </div>
    </div>
</body>

</html>