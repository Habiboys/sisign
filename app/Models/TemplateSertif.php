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
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updatedAt' => 'datetime',
    ];

    public function review(): BelongsTo
    {
        return $this->belongsTo(Review::class, 'reviewId');
    }

    public function sertifikats(): HasMany
    {
        return $this->hasMany(Sertifikat::class, 'templateSertifId');
    }
}
