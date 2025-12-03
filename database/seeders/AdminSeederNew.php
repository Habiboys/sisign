<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;

class AdminSeederNew extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {

        User::create([
            'name' => 'Pimpinan2',
            'email' => 'pimpinan2@sisign.com',
            'password' => bcrypt('password'),
            'role' => 'pimpinan',
            'email_verified_at' => now(),
        ]);

    }
}
