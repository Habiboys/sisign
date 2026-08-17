<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class AdminSeederNew extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {

        User::firstOrCreate(
            ['email' => 'pimpinan2@sisign.com'],
            [
                'name' => 'Pimpinan2',
                'password' => bcrypt('password'),
                'role' => 'pimpinan',
                'email_verified_at' => now(),
            ]
        );

    }
}
