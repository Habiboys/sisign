<?php

use App\Models\TemplateSertif;

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$template = TemplateSertif::latest('updatedAt')->first();

if ($template) {
    echo "Template ID: " . $template->id . "\n";
    echo "Title: " . $template->title . "\n";
    echo "Variable Positions (Raw): " . json_encode($template->getAttributes()['variable_positions'] ?? 'NULL') . "\n";
    echo "Variable Positions (Cast): " . json_encode($template->variable_positions) . "\n";
} else {
    echo "No template found.\n";
}
