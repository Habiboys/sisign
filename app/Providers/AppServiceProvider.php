<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Rute verifikasi publik (dokumen/template/sertifikat) rawan scraping/enumeration.
        RateLimiter::for('verification', function (Request $request) {
            return Limit::perMinute(30)->by($request->ip());
        });

        // Percobaan submit PIN saat tanda tangan digital, batasi per user untuk cegah brute force.
        RateLimiter::for('pin-attempts', function (Request $request) {
            return Limit::perMinute(10)->by($request->user()?->id ?: $request->ip());
        });
    }
}
