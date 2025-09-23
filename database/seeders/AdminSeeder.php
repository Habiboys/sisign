<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class AdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        \App\Models\User::create([
            'name' => 'Administrator',
            'email' => 'admin@sisign.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'email_verified_at' => now(),
        ]);

        \App\Models\User::create([
            'name' => 'Pimpinan',
            'email' => 'pimpinan@sisign.com',
            'password' => bcrypt('password'),
            'role' => 'pimpinan',
            'email_verified_at' => now(),
        ]);

        \App\Models\User::create([
            'name' => 'Pengaju',
            'email' => 'pengaju@sisign.com',
            'password' => bcrypt('password'),
            'role' => 'pengaju',
            'email_verified_at' => now(),
        ]);
    }
}
