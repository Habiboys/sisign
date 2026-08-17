<?php

namespace Database\Factories;

use App\Models\Review;
use App\Models\TemplateSertif;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TemplateSertif>
 */
class TemplateSertifFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'files' => 'templates/'.fake()->uuid().'.pdf',
            'title' => fake()->sentence(3),
            'description' => fake()->optional()->paragraph(),
            'reviewId' => Review::factory(),
        ];
    }

    public function signed(): static
    {
        return $this->state(fn (array $attributes) => [
            'signed_template_path' => 'templates/signed/'.fake()->uuid().'.pdf',
        ]);
    }
}
