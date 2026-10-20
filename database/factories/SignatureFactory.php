<?php

namespace Database\Factories;

use App\Models\Document;
use App\Models\Signature;
use App\Models\TemplateSertif;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Signature>
 */
class SignatureFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'documentId' => Document::factory(),
            'templateSertifId' => null,
            'userId' => User::factory(),
            'type' => 'physical',
            'signatureFile' => 'signatures/'.fake()->uuid().'.png',
            'position_x' => fake()->numberBetween(0, 500),
            'position_y' => fake()->numberBetween(0, 700),
            'width' => 150,
            'height' => 75,
            'page_number' => 1,
            'signedAt' => now(),
        ];
    }

    public function digital(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'digital',
            'signatureFile' => null,
            'signatureHash' => hash('sha256', fake()->text()),
            'digital_signature' => base64_encode(fake()->text()),
            'signature_timestamp' => now(),
        ]);
    }

    public function forTemplate(): static
    {
        return $this->state(fn (array $attributes) => [
            'documentId' => null,
            'templateSertifId' => TemplateSertif::factory(),
        ]);
    }
}
