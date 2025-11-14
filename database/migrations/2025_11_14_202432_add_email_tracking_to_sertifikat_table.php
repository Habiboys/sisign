<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('sertifikat', function (Blueprint $table) {
            $table->timestamp('email_sent_at')->nullable()->after('email');
            $table->enum('email_sent_status', ['pending', 'sent', 'failed'])->default('pending')->after('email_sent_at');
            $table->text('email_sent_error')->nullable()->after('email_sent_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sertifikat', function (Blueprint $table) {
            $table->dropColumn(['email_sent_at', 'email_sent_status', 'email_sent_error']);
        });
    }
};
