<?php

namespace App\Services;

use App\Models\TemplateSertif;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class ExcelTemplateService
{
    public function generateTemplateExcel(TemplateSertif $template): string
    {
        $filename = 'Template_Excel_' . $template->title . '_' . date('Y-m-d') . '.xlsx';
        $filepath = storage_path('app/temp/' . $filename);

        // Ensure temp directory exists
        if (!file_exists(dirname($filepath))) {
            mkdir(dirname($filepath), 0755, true);
        }

        Excel::store(new TemplateExcelExport($template), $filename, 'temp');

        return $filepath;
    }

    public function downloadTemplateExcel(TemplateSertif $template)
    {
        $filename = 'Template_Excel_' . str_replace(' ', '_', $template->title) . '_' . date('Y-m-d') . '.xlsx';

        return Excel::download(new TemplateExcelExport($template), $filename);
    }
}

class TemplateExcelExport implements FromArray, WithHeadings, WithStyles
{
    protected TemplateSertif $template;

    public function __construct(TemplateSertif $template)
    {
        $this->template = $template;
    }

    /**
     * Generate array data untuk Excel
     * PENTING: Urutan kolom Excel HARUS sama dengan urutan variabel di variable_positions
     * Kolom 0 = variable_positions[0], Kolom 1 = variable_positions[1], dst
     */

    public function array(): array
    {
        // Generate example data based on variable positions - URUTAN HARUS SAMA DENGAN VARIABLE_POSITIONS
        $variables = $this->template->variable_positions ?? [];

        if (empty($variables)) {
            // Default columns if no variables mapped
            return [
                [
                    'SERT-001',
                    'john.doe@example.com',
                    date('Y-m-d'),
                    'John Doe',
                ],
                [
                    'SERT-002',
                    'jane.smith@example.com',
                    date('Y-m-d'),
                    'Jane Smith',
                ],
                [
                    'SERT-003',
                    'bob.wilson@example.com',
                    date('Y-m-d'),
                    'Bob Wilson',
                ]
            ];
        }

        // Cek apakah nomor_sertif dan email sudah ada di variabel
        $hasNomorSertif = false;
        $hasEmail = false;
        foreach ($variables as $variable) {
            $varName = strtolower($variable['name']);
            if (in_array($varName, ['nomor_sertif', 'nomor', 'no_sertifikat', 'no', 'nomor_sertifikat'])) {
                $hasNomorSertif = true;
            }
            if (in_array($varName, ['email', 'e_mail', 'alamat_email', 'email_peserta'])) {
                $hasEmail = true;
            }
        }

        // Generate example data berdasarkan URUTAN variabel yang sudah di-mapping
        // Setiap kolom Excel = 1 variabel sesuai urutan
        $exampleData = [];

        // Generate 3 baris contoh data
        for ($i = 1; $i <= 3; $i++) {
            $dataRow = [];

            // Loop sesuai urutan variabel - PENTING: urutan harus sama dengan variable_positions
            foreach ($variables as $variable) {
                $varName = strtolower($variable['name']);

                // Generate contoh data berdasarkan nama variabel yang SEBENARNYA
                if (in_array($varName, ['nomor_sertif', 'nomor', 'no_sertifikat', 'no', 'nomor_sertifikat'])) {
                    $dataRow[] = 'SERT-' . str_pad($i, 3, '0', STR_PAD_LEFT);
                } elseif (in_array($varName, ['email', 'e_mail', 'alamat_email', 'email_peserta'])) {
                    $dataRow[] = 'user' . $i . '@example.com';
                } elseif (in_array($varName, ['issued_at', 'tanggal_terbit', 'tanggal', 'tgl_terbit', 'date'])) {
                    $dataRow[] = date('Y-m-d');
                } elseif (in_array($varName, ['nama_lengkap', 'nama', 'name', 'nama_peserta', 'peserta', 'nama_gacor'])) {
                    // Support nama_gacor dan variasi nama lainnya
                    $names = ['John Doe', 'Jane Smith', 'Bob Wilson'];
                    $dataRow[] = $names[$i - 1] ?? 'Peserta ' . $i;
                } elseif (in_array($varName, ['jabatan', 'position', 'posisi'])) {
                    $positions = ['Manager', 'Senior Developer', 'Analyst'];
                    $dataRow[] = $positions[$i - 1] ?? 'Jabatan ' . $i;
                } elseif (in_array($varName, ['departemen', 'department', 'dept'])) {
                    $departments = ['IT Department', 'IT Department', 'Finance Department'];
                    $dataRow[] = $departments[$i - 1] ?? 'Departemen ' . $i;
                } else {
                    // Untuk variabel lain, gunakan contoh data berdasarkan nama variabel
                    // Contoh: nama_gacor -> "Contoh Nama Gacor 1"
                    $dataRow[] = 'Contoh ' . ucwords(str_replace('_', ' ', $varName)) . ' ' . $i;
                }
            }

            // Tambahkan Nomor Sertifikat di akhir jika belum ada di variabel (WAJIB)
            if (!$hasNomorSertif) {
                $dataRow[] = 'SERT-' . str_pad($i, 3, '0', STR_PAD_LEFT);
            }

            // Tambahkan email di akhir jika belum ada di variabel (WAJIB)
            if (!$hasEmail) {
                $dataRow[] = 'user' . $i . '@example.com';
            }

            $exampleData[] = $dataRow;
        }

        return $exampleData;
    }

    public function headings(): array
    {
        $variables = $this->template->variable_positions ?? [];

        if (empty($variables)) {
            // Default headings if no variables mapped
            return [
                'Nomor Sertifikat',
                'Email',
                'Tanggal Terbit',
                'Nama Lengkap',
            ];
        }

        // Generate headings berdasarkan URUTAN variabel yang sudah di-mapping
        // Urutan heading = urutan variabel di variable_positions = urutan kolom Excel
        $headings = [];

        // Cek apakah nomor_sertif dan email sudah ada di variabel
        $hasNomorSertif = false;
        $hasEmail = false;
        foreach ($variables as $variable) {
            $varName = strtolower($variable['name']);
            if (in_array($varName, ['nomor_sertif', 'nomor', 'no_sertifikat', 'no', 'nomor_sertifikat'])) {
                $hasNomorSertif = true;
            }
            if (in_array($varName, ['email', 'e_mail', 'alamat_email', 'email_peserta'])) {
                $hasEmail = true;
            }
        }

        // Generate heading untuk setiap variabel sesuai urutan
        foreach ($variables as $variable) {
            $name = $variable['name'];
            // Convert snake_case to Title Case dengan format yang lebih baik
            $heading = ucwords(str_replace('_', ' ', $name));
            $headings[] = $heading;
        }

        // Tambahkan Nomor Sertifikat di akhir jika belum ada di variabel (WAJIB)
        if (!$hasNomorSertif) {
            $headings[] = 'Nomor Sertifikat';
        }

        // Tambahkan Email di akhir jika belum ada di variabel (WAJIB untuk kirim sertifikat)
        if (!$hasEmail) {
            $headings[] = 'Email';
        }

        return $headings;
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => [
                'font' => [
                    'bold' => true,
                    'color' => ['rgb' => 'FFFFFF']
                ],
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '366092']
                ]
            ]
        ];
    }
}
