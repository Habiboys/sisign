<?php

namespace Database\Factories;

use App\Models\Document;
use App\Models\DocumentSigner;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DocumentSigner>
 */
class DocumentSignerFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'document_id' => Document::factory(),
            'user_id' => User::factory(['role' => 'pimpinan']),
            'is_signed' => false,
            'sign_order' => 1,
        ];
    }

    public function signed(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_signed' => true,
        ]);
    }
}
