<?php

namespace App\Services;

use setasign\Fpdi\Tcpdf\Fpdi;

class CertificatePdf extends Fpdi
{
    /** @param list<string> $colors */
    public function drawGradientText(float $x, float $baseline, string $text, array $colors, float $angle): void
    {
        $width = $this->GetStringWidth($text);
        if ($width <= 0) {
            return;
        }

        $size = $this->getFontSize();
        $height = $size * 1.3;
        $top = $baseline - $size;
        $style = $this->getFontStyle();
        $family = $this->getFontFamily();
        $points = $this->getFontSizePt();
        $this->SetFont($family, str_replace('U', '', $style), $points);
        $this->StartTransform();
        try {
            $this->Text($x, $baseline, $text, fclip: true, ffill: false, calign: 'L');
            $this->paintGradient($x, $top, $width, $height, $colors, $angle);
        } finally {
            $this->StopTransform();
            $this->SetFont($family, $style, $points);
        }

        if (str_contains($style, 'U')) {
            $this->StartTransform();
            try {
                $this->Rect($x, $baseline + $size * 0.1, $width, $size / 18, 'CNZ');
                $this->paintGradient($x, $top, $width, $height, $colors, $angle);
            } finally {
                $this->StopTransform();
            }
        }
    }

    /** @param list<string> $colors */
    private function paintGradient(float $x, float $y, float $width, float $height, array $colors, float $angle): void
    {
        $radians = deg2rad($angle);
        $cos = cos($radians);
        $sin = sin($radians);
        $length = abs($width * $cos) + abs($height * $sin);
        // A square shading space preserves angles on wide text boxes.
        $side = max($width, $height);
        $dx = $cos * $length / (2 * $side);
        $dy = $sin * $length / (2 * $side);
        $stops = [];
        foreach (array_values($colors) as $index => $color) {
            $stops[] = [
                'color' => [hexdec(substr($color, 1, 2)), hexdec(substr($color, 3, 2)), hexdec(substr($color, 5, 2))],
                'offset' => $index / (count($colors) - 1),
                'exponent' => 1,
            ];
        }

        $this->Clip($x - ($side - $width) / 2, $y - ($side - $height) / 2, $side, $side);
        $this->Gradient(2, [0.5 - $dx, 0.5 + $dy, 0.5 + $dx, 0.5 - $dy], $stops);
    }
}
