<?php

namespace Tests\Feature\Settings;

use App\Models\Document;
use App\Models\DocumentSigner;
use App\Models\Review;
use App\Models\Sertifikat;
use App\Models\Signature;
use App\Models\TemplateSertif;
use App\Models\TemplateSigner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FactorySmokeTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_new_factories_create_valid_models(): void
    {
        $this->assertNotNull(Document::factory()->create()->id);
        $this->assertNotNull(TemplateSertif::factory()->create()->id);
        $this->assertNotNull(Signature::factory()->create()->id);
        $this->assertNotNull(Signature::factory()->digital()->create()->id);
        $this->assertNotNull(Signature::factory()->forTemplate()->create()->id);
        $this->assertNotNull(Review::factory()->create()->id);
        $this->assertNotNull(Review::factory()->approved()->create()->id);
        $this->assertNotNull(Review::factory()->rejected()->create()->id);
        $this->assertNotNull(Sertifikat::factory()->create()->id);
        $this->assertNotNull(DocumentSigner::factory()->create()->id);
        $this->assertNotNull(DocumentSigner::factory()->signed()->create()->id);
        $this->assertNotNull(TemplateSigner::factory()->create()->id);
        $this->assertNotNull(TemplateSigner::factory()->signed()->create()->id);
    }
}
