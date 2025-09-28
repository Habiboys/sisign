<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Sertifikat extends Model
{
    use SoftDeletes, HasUuids;

    protected $table = 'sertifikat';

    protected $fillable = [
        'templateSertifId',
        'nomor_sertif',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updatedAt' => 'datetime',
    ];

    // Override timestamp column names
    const CREATED_AT = 'created_at';
    const UPDATED_AT = 'updatedAt';

    public function templateSertif(): BelongsTo
    {
        return $this->belongsTo(TemplateSertif::class, 'templateSertifId');
    }

    public function certificateRecipients(): HasMany
    {
        return $this->hasMany(CertificateRecipient::class, 'sertifikatId');
    }
}
