<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class TemplateGuideController extends Controller
{
    public function index()
    {
        return Inertia::render('TemplateGuide/Variables', [
            'user' => Auth::user()
        ]);
    }

    public function downloadExampleTemplate()
    {
        $exampleContent = '
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Template Sertifikat - Contoh</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .certificate { 
            border: 3px solid #333; 
            padding: 40px; 
            text-align: center; 
            background: #f9f9f9;
            max-width: 800px;
            margin: 0 auto;
        }
        .header { font-size: 24px; font-weight: bold; margin-bottom: 30px; }
        .content { font-size: 16px; line-height: 1.6; margin: 20px 0; }
        .signature-area { margin-top: 50px; }
        .variable { background: #ffffcc; padding: 2px 4px; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="certificate">
        <div class="header">SERTIFIKAT</div>
        <div class="header">{{judul_template}}</div>
        
        <div class="content">
            <p>Diberikan kepada:</p>
            <p><strong>{{nama_penerima}}</strong></p>
            <p>{{jabatan}} - {{departemen}}</p>
            
            <p>Nomor Sertifikat: <span class="variable">{{nomor_sertifikat}}</span></p>
            <p>Tanggal Terbit: <span class="variable">{{tanggal_terbit|d F Y}}</span></p>
            
            <p>Atas prestasi dan dedikasi yang luar biasa dalam program pelatihan.</p>
        </div>
        
        <div class="signature-area">
            <p>Jakarta, {{tanggal_terbit|d F Y}}</p>
            <br><br>
            <p>_________________________</p>
            <p>Direktur</p>
        </div>
    </div>
</body>
</html>';

        return response($exampleContent)
            ->header('Content-Type', 'text/html')
            ->header('Content-Disposition', 'attachment; filename="template_sertifikat_contoh.html"');
    }
}
