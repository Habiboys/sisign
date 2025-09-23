<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Review extends Model
{
    use HasUuids;
    protected $table = 'review';

    protected $fillable = [
        'status',
        'disetujui',
        'komentar',
    ];

    protected $casts = [
        'createdAt' => 'datetime',
    ];

    public function disetujuiBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'disetujui');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'reviewId');
    }

    public function templateSertifs(): HasMany
    {
        return $this->hasMany(TemplateSertif::class, 'reviewId');
    }
}
