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
        'variable_positions',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updatedAt' => 'datetime',
        'variable_positions' => 'array',
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

    public function signers(): HasMany
    {
        return $this->hasMany(TemplateSigner::class, 'template_id');
    }

    public function isCompleted(): bool
    {
        // Check if all signers have signed
        $totalSigners = $this->signers()->count();
        if ($totalSigners === 0) {
            // Fallback for legacy templates or if no signers defined yet
            return false;
        }
        
        $signedCount = $this->signers()->where('is_signed', true)->count();
        return $totalSigners === $signedCount;
    }
}
