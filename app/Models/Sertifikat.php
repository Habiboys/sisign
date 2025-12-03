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
        'email',
        'file_path',
        'email_sent_at',
        'email_sent_status',
        'email_sent_error',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'email_sent_at' => 'datetime',
    ];

    // Override timestamp column names
    const CREATED_AT = 'created_at';
    const UPDATED_AT = 'updated_at';

    public function templateSertif(): BelongsTo
    {
        return $this->belongsTo(TemplateSertif::class, 'templateSertifId');
    }

    public function certificateRecipients(): HasMany
    {
        return $this->hasMany(CertificateRecipient::class, 'sertifikatId');
    }

    /**
     * Resolve route binding untuk support pencarian berdasarkan nomor_sertif atau UUID
     */
    public function resolveRouteBinding($value, $field = null)
    {
        // Try to find by nomor_sertif first (for verification URLs)
        $sertifikat = $this->where('nomor_sertif', $value)->first();

        // If not found, try by UUID (default behavior)
        if (!$sertifikat) {
            $sertifikat = $this->where($field ?? $this->getRouteKeyName(), $value)->first();
        }

        return $sertifikat;
    }
}
