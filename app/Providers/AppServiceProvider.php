<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL;

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
        // Force HTTPS in production
        if (app()->environment('production')) {
            URL::forceScheme('https');
            
            // Force HTTPS for asset URLs
            if (config('app.asset_url')) {
                config(['app.asset_url' => str_replace('http://', 'https://', config('app.asset_url'))]);
            }
        }
    }
}
