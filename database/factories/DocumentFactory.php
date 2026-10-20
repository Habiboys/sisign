<?php

namespace Database\Factories;

use App\Models\Document;
use App\Models\Review;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Document>
 */
class DocumentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'userId' => User::factory(),
            'title' => fake()->sentence(4),
            'files' => 'documents/'.fake()->uuid().'.pdf',
            'number' => fake()->unique()->bothify('DOC-####/????'),
            'to' => User::factory(),
            'reviewId' => Review::factory(),
        ];
    }

    public function signed(): static
    {
        return $this->state(fn (array $attributes) => [
            'signed_file' => 'documents/signed/'.fake()->uuid().'.pdf',
        ]);
    }
}
