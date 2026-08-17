<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class AdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'admin@sisign.com'],
            [
                'name' => 'Administrator',
                'password' => bcrypt('password'),
                'role' => 'admin',
                'email_verified_at' => now(),
            ]
        );

        User::firstOrCreate(
            ['email' => 'pimpinan@sisign.com'],
            [
                'name' => 'Pimpinan',
                'password' => bcrypt('password'),
                'role' => 'pimpinan',
                'email_verified_at' => now(),
            ]
        );

        User::firstOrCreate(
            ['email' => 'pengaju@sisign.com'],
            [
                'name' => 'Pengaju',
                'password' => bcrypt('password'),
                'role' => 'pengaju',
                'email_verified_at' => now(),
            ]
        );
    }
}
