<?php

require_once 'vendor/autoload.php';

$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Memperbaiki template yang memiliki path salah...\n";

$template = \App\Models\TemplateSertif::find('0199a7c3-92a1-709c-b43e-4be517f7868a');
if ($template) {
    $template->signed_template_path = null;
    $template->save();
    echo "Template 'Contoh 1' signed_template_path direset\n";
} else {
    echo "Template tidak ditemukan\n";
}

echo "Selesai!\n";

