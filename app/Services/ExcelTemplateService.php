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

    public function array(): array
    {
        return [
            [
                'SERT-001',
                'john.doe@example.com',
                date('Y-m-d'),
                'John Doe',
                'Manager',
                'IT Department'
            ],
            [
                'SERT-002',
                'jane.smith@example.com',
                date('Y-m-d'),
                'Jane Smith',
                'Senior Developer',
                'IT Department'
            ],
            [
                'SERT-003',
                'bob.wilson@example.com',
                date('Y-m-d'),
                'Bob Wilson',
                'Analyst',
                'Finance Department'
            ]
        ];
    }

    public function headings(): array
    {
        return [
            'Nomor Sertifikat',
            'Email',
            'Tanggal Terbit',
            'Nama Lengkap',
            'Jabatan',
            'Departemen'
        ];
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

