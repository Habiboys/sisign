<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class TemplateSertif extends Model
{
    use SoftDeletes, HasUuids;

    protected $table = 'template_sertif';

    protected $fillable = [
        'files',
        'title',
        'description',
        'reviewId',
        'signed_template_path',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updatedAt' => 'datetime',
    ];

    // Override timestamp column names
    const CREATED_AT = 'created_at';
    const UPDATED_AT = 'updatedAt';

    public function review(): BelongsTo
    {
        return $this->belongsTo(Review::class, 'reviewId');
    }

    public function sertifikats(): HasMany
    {
        return $this->hasMany(Sertifikat::class, 'templateSertifId');
    }
}
