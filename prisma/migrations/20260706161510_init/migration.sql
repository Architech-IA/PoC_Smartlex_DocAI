-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "Proyecto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "notionPageId" TEXT,
    "obsidianNota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "area" TEXT,
    "origen" TEXT NOT NULL,
    "origenCarpeta" TEXT,
    "archivoBase64" TEXT,
    "mimeType" TEXT,
    "tamanoBytes" INTEGER,
    "hashSha256" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PROCESANDO',
    "resumen" TEXT,
    "datosClave" TEXT,
    "textoExtraido" TEXT,
    "embedding" vector(1024),
    "documentoPadreId" TEXT,
    "esVersionActual" BOOLEAN NOT NULL DEFAULT true,
    "versionNumero" INTEGER NOT NULL DEFAULT 1,
    "creadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoAuditoria" (
    "id" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "actor" TEXT,
    "detalle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Documento_hashSha256_key" ON "Documento"("hashSha256");

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_documentoPadreId_fkey" FOREIGN KEY ("documentoPadreId") REFERENCES "Documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoAuditoria" ADD CONSTRAINT "EventoAuditoria_entidadId_fkey" FOREIGN KEY ("entidadId") REFERENCES "Documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
