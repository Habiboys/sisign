<?php

namespace Database\Factories;

use App\Models\Sertifikat;
use App\Models\TemplateSertif;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Sertifikat>
 */
class SertifikatFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'templateSertifId' => TemplateSertif::factory(),
            'nomor_sertif' => fake()->unique()->bothify('CERT-####/????'),
            'email' => fake()->safeEmail(),
            'file_path' => 'certificates/'.fake()->uuid().'.pdf',
        ];
    }
}
