<?php

namespace Tests\Feature;

use App\Models\TemplateSertif;
use App\Models\TemplateSigner;
use App\Models\User;
use App\Services\CertificatePdf;
use App\Services\CertificateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use ReflectionMethod;
use setasign\Fpdi\Tcpdf\Fpdi;
use Tests\TestCase;

class CertificateMappingTest extends TestCase
{
    use RefreshDatabase;

    private function mapping(array $overrides = []): array
    {
        return array_replace([
            'name' => 'nama_lengkap', 'x' => 400, 'y' => 300,
            'x_pct' => 0.5, 'y_pct' => 0.5,
            'fontSize' => 24, 'fontFamily' => 'DejaVu Serif',
            'fontStyle' => 'BIU', 'textColor' => '#2456ab',
            'alignment' => 'C', 'layoutVersion' => 2,
        ], $overrides);
    }

    public function test_mapping_saves_font_style_color_and_layout(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $template = TemplateSertif::factory()->signed()->create();
        TemplateSigner::factory()->signed()->create(['template_id' => $template->id]);
        $mapping = $this->mapping(['opacity' => 0.35, 'colorMode' => 'gradient', 'gradientColors' => ['#ff0000', '#00ff00', '#0000ff'], 'gradientAngle' => 135]);
        $this->actingAs($user)->post(route('templates.save-variable-positions', $template), [
            'variable_positions' => [$mapping],
        ])->assertSessionHasNoErrors()->assertRedirect();
        $this->assertEquals([$mapping], $template->fresh()->variable_positions);
    }

    public function test_invalid_style_color_size_and_coordinates_are_rejected(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $template = TemplateSertif::factory()->signed()->create();
        TemplateSigner::factory()->signed()->create(['template_id' => $template->id]);
        $this->actingAs($user)->post(route('templates.save-variable-positions', $template), [
            'variable_positions' => [$this->mapping(['fontStyle' => 'INVALID', 'textColor' => 'red', 'fontSize' => 100, 'x_pct' => 2, 'opacity' => 2, 'colorMode' => 'invalid', 'gradientAngle' => 500, 'gradientColors' => ['red']])],
        ])->assertSessionHasErrors(['variable_positions.0.fontStyle', 'variable_positions.0.textColor', 'variable_positions.0.fontSize', 'variable_positions.0.x_pct', 'variable_positions.0.opacity', 'variable_positions.0.colorMode', 'variable_positions.0.gradientAngle', 'variable_positions.0.gradientColors', 'variable_positions.0.gradientColors.0']);
        $this->assertNull($template->fresh()->variable_positions);
    }

    public function test_unsigned_template_cannot_save_mapping(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $template = TemplateSertif::factory()->create();
        $this->actingAs($user)->post(route('templates.save-variable-positions', $template), [
            'variable_positions' => [$this->mapping()],
        ])->assertSessionHas('error');
        $this->assertNull($template->fresh()->variable_positions);
    }

    public static function typographyCases(): array
    {
        return [
            'sans normal left portrait' => ['DejaVu Sans', 'dejavusans', 'N', '', 'L', 210, 297],
            'serif bold italic centered landscape' => ['DejaVu Serif', 'dejavuserif', 'BI', 'BI', 'C', 297, 210],
            'mono underline right portrait' => ['DejaVu Sans Mono', 'dejavusansmono', 'U', 'U', 'R', 210, 297],
            'core font all styles' => ['Arial', 'helvetica', 'BIU', 'BIU', 'C', 210, 297],
        ];
    }

    #[DataProvider('typographyCases')]
    public function test_pdf_uses_selected_typography_and_preview_anchor(string $family, string $pdfFamily, string $style, string $expectedStyle, string $alignment, int $width, int $height): void
    {
        $pdf = $this->getMockBuilder(Fpdi::class)->onlyMethods(['Text', 'SetTextColor'])->getMock();
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);
        $pdf->AddPage($width > $height ? 'L' : 'P', [$width, $height]);
        $pdf->SetFont($pdfFamily, $expectedStyle, 24);
        $text = 'Rizky Pratama';
        $textWidth = $pdf->GetStringWidth($text);
        $expectedX = $width / 2 - match ($alignment) {
            'C' => $textWidth / 2, 'R' => $textWidth, default => 0
        };
        $pdf->expects($this->once())->method('SetTextColor')->with(36, 86, 171);
        $pdf->expects($this->once())->method('Text')->with($expectedX, $height / 2, $text, 0, false, true, 0, 0, '', false, '', 0, false, 'L');
        $template = new TemplateSertif(['variable_positions' => [$this->mapping(['fontFamily' => $family, 'fontStyle' => $style, 'alignment' => $alignment, 'layoutVersion' => '2'])]]);
        $method = new ReflectionMethod(CertificateService::class, 'addTextOverlayWithVariables');
        $method->invoke(app(CertificateService::class), $pdf, $template, [$text], 'CERT-001', null, ['width' => $width, 'height' => $height], 'test-certificate', false);
        $this->assertSame($pdfFamily, $pdf->getFontFamily());
        $this->assertSame($expectedStyle, $pdf->getFontStyle());
        $this->assertSame(24.0, $pdf->getFontSizePt());
        $this->assertStringStartsWith('%PDF-', $pdf->Output('', 'S'));
    }

    public function test_old_mapping_retains_bold_font_and_legacy_positioning(): void
    {
        $pdf = $this->getMockBuilder(Fpdi::class)->onlyMethods(['Cell'])->getMock();
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);
        $pdf->AddPage();
        $pdf->expects($this->once())->method('Cell');
        $mapping = $this->mapping();
        unset($mapping['layoutVersion'], $mapping['fontStyle'], $mapping['textColor']);
        $template = new TemplateSertif(['variable_positions' => [$mapping]]);
        (new ReflectionMethod(CertificateService::class, 'addTextOverlayWithVariables'))->invoke(app(CertificateService::class), $pdf, $template, ['Legacy Name'], 'CERT-001', null, ['width' => 210, 'height' => 297], 'test-certificate', false);
        $this->assertSame('B', $pdf->getFontStyle());
        $this->assertEquals(144.5, $pdf->GetY());
    }

    public function test_gradient_pdf_clips_text_embeds_multiple_colors_and_restores_opacity(): void
    {
        $pdf = new CertificatePdf;
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);
        $pdf->setCompression(false);
        $pdf->AddPage();
        $template = new TemplateSertif(['variable_positions' => [
            $this->mapping(['fontSize' => 36, 'opacity' => 0.35, 'colorMode' => 'gradient', 'gradientColors' => ['#ff0000', '#00ff00', '#0000ff'], 'gradientAngle' => 0, 'y_pct' => 0.3]),
            $this->mapping(['name' => 'jabatan', 'fontStyle' => 'N', 'textColor' => '#000000', 'y_pct' => 0.45]),
        ]]);
        (new ReflectionMethod(CertificateService::class, 'addTextOverlayWithVariables'))->invoke(app(CertificateService::class), $pdf, $template, ['GRADIENT TEXT', 'Solid text after gradient'], 'CERT-001', null, ['width' => 210, 'height' => 297], 'test-certificate', false);
        $this->assertEquals(1, $pdf->getAlpha()['CA']);
        $bytes = $pdf->Output('', 'S');
        $this->assertStringContainsString('/ShadingType 2', $bytes);
        $this->assertStringContainsString('/FunctionType 3', $bytes);
        $this->assertStringContainsString('7 Tr', $bytes);
        $this->assertStringContainsString('/ca 0.350000', $bytes);
        $this->assertStringContainsString('/ca 1.000000', $bytes);
        file_put_contents(sys_get_temp_dir().'/sisign-gradient-test.pdf', $bytes);
    }

    public function test_zero_opacity_and_vertical_five_color_gradient_render_without_errors(): void
    {
        $pdf = new CertificatePdf;
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);
        $pdf->setCompression(false);
        $pdf->AddPage();
        $template = new TemplateSertif(['variable_positions' => [$this->mapping(['opacity' => 0, 'colorMode' => 'gradient', 'gradientColors' => ['#ff0000', '#ffaa00', '#00ff00', '#00aaff', '#0000ff'], 'gradientAngle' => 90])]]);
        (new ReflectionMethod(CertificateService::class, 'addTextOverlayWithVariables'))->invoke(app(CertificateService::class), $pdf, $template, ['Invisible'], 'CERT-001', null, ['width' => 210, 'height' => 297], 'test-certificate', false);
        $bytes = $pdf->Output('', 'S');
        $this->assertStringContainsString('/ShadingType 2', $bytes);
        $this->assertStringContainsString('/ca 0.000000', $bytes);
    }

    public function test_mapping_rejects_more_than_five_gradient_colors(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $template = TemplateSertif::factory()->signed()->create();
        TemplateSigner::factory()->signed()->create(['template_id' => $template->id]);
        $this->actingAs($user)->post(route('templates.save-variable-positions', $template), [
            'variable_positions' => [$this->mapping(['colorMode' => 'gradient', 'gradientColors' => array_fill(0, 6, '#ff0000')])],
        ])->assertSessionHasErrors('variable_positions.0.gradientColors');
    }

    public function test_gradient_directions_and_empty_text_are_supported(): void
    {
        $pdf = new CertificatePdf;
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);
        $pdf->setCompression(false);
        $pdf->AddPage();
        $pdf->SetFont('dejavusans', 'BU', 24);
        $colors = ['#2563eb', '#9333ea', '#f97316'];
        foreach ([0, 45, 90, 135, 180, 225, 270, 315] as $row => $angle) {
            $pdf->drawGradientText(20, 30 + $row * 30, 'Gradient '.$angle, $colors, $angle);
            $this->assertSame('BU', $pdf->getFontStyle());
        }
        $pdf->drawGradientText(20, 290, '', $colors, 0);
        $bytes = $pdf->Output('', 'S');
        $this->assertSame(16, substr_count($bytes, '/ShadingType 2'));
        file_put_contents(sys_get_temp_dir().'/sisign-gradient-directions.pdf', $bytes);
    }

    public function test_diagonal_gradient_keeps_its_angle_on_wide_text(): void
    {
        $pdf = new CertificatePdf;
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);
        $pdf->AddPage();
        $pdf->SetFont('dejavusans', 'B', 24);
        $pdf->drawGradientText(20, 40, 'A very wide certificate recipient name', ['#ff0000', '#0000ff'], 45);
        $bytes = $pdf->Output('', 'S');
        $this->assertSame(1, preg_match('/\/Coords\s*\[([^\]]+)\]/', $bytes, $matches));
        $coordinates = array_map('floatval', preg_split('/\s+/', trim($matches[1])));
        $this->assertEqualsWithDelta($coordinates[2] - $coordinates[0], $coordinates[1] - $coordinates[3], 0.00001);
    }
}
