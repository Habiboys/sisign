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
        'signed_file',
        'number',
        'to',
        'reviewId',
    ];
    protected $keyType = 'string';   // penting!
    public $incrementing = false;    // matikan auto increment



    public function user()
    {
        return $this->belongsTo(User::class, 'userId');
    }

    public function toUser()
    {
        return $this->belongsTo(User::class, 'to');
    }

    public function review()
    {
        return $this->belongsTo(Review::class, 'reviewId');
    }

    public function signatures()
    {
        return $this->hasMany(Signature::class, 'documentId');
    }

    public function signers()
    {
        return $this->hasMany(DocumentSigner::class, 'document_id');
    }

    public function isCompleted(): bool
    {
        // Check if all signers have signed
        $totalSigners = $this->signers()->count();
        if ($totalSigners === 0) {
            // Fallback for legacy documents or if no signers defined yet
            return false;
        }
        
        $signedCount = $this->signers()->where('is_signed', true)->count();
        return $totalSigners === $signedCount;
    }
}
