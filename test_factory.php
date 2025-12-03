<?php

use App\Models\User;

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    echo "Creating user with role 'pengaju'...\n";
    $user = User::factory()->create(['role' => 'pengaju']);
    echo "User created successfully: " . $user->role . "\n";

    echo "Creating user with role 'pimpinan'...\n";
    $user2 = User::factory()->create(['role' => 'pimpinan']);
    echo "User created successfully: " . $user2->role . "\n";

} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
