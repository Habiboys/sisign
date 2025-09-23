<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\TemplateSertif;
use App\Models\Sertifikat;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index()
    {
        $user = auth()->user();
        

        $stats = [
            'total_documents' => Document::count(),
            'pending_reviews' => Document::join('review', 'document.reviewId', '=', 'review.id')
                ->where('review.status', 'pending')
                ->count(),
            'total_templates' => TemplateSertif::count(),
            'total_certificates' => Sertifikat::count(),
        ];

        $recent_documents = collect();

        return Inertia::render('dashboard', [
            'user' => $user,
            'stats' => $stats,
            'recent_documents' => $recent_documents,
        ]);
    }
}
