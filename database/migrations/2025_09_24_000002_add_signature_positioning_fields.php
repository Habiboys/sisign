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
        Schema::table('signatures', function (Blueprint $table) {
            // Menambah field untuk positioning signature
            $table->integer('position_x')->nullable()->after('isUnique');
            $table->integer('position_y')->nullable()->after('position_x');
            $table->integer('width')->default(150)->after('position_y');
            $table->integer('height')->default(75)->after('width');
            $table->integer('page_number')->default(1)->after('height');
            
            // Field tambahan untuk digital signature
            $table->text('digital_signature')->nullable()->after('page_number');
            $table->timestamp('signature_timestamp')->nullable()->after('digital_signature');
            $table->string('certificate_info')->nullable()->after('signature_timestamp');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('signatures', function (Blueprint $table) {
            $table->dropColumn([
                'position_x', 
                'position_y', 
                'width', 
                'height', 
                'page_number',
                'digital_signature',
                'signature_timestamp',
                'certificate_info'
            ]);
        });
    }
};