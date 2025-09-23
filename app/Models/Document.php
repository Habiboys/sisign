<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Document extends Model
{
    use SoftDeletes, HasUuids;

    protected $table = 'document';

    protected $fillable = [
        'userId',
        'title',
        'files',
        'number',
        'to',
        'reviewId',
    ];

    protected $casts = [
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId');
    }

    public function toUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'to');
    }

    public function review(): BelongsTo
    {
        return $this->belongsTo(Review::class, 'reviewId');
    }

    public function signatures(): HasMany
    {
        return $this->hasMany(Signature::class, 'documentId');
    }
}
