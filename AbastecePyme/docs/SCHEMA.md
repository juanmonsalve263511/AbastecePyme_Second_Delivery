# Modelo relacional de AbastecePyme
Todas las tablas usan InnoDB y utf8mb4. Los identificadores globales de elementos usan ASCII sensible a mayúsculas.
- Elements: ElementId PK, Name, ElementType, Description, Version.
- Suppliers: ElementId PK/FK→Elements, Contact.
- Materials: ElementId PK/FK→Elements, UnitCode.
- Products: ElementId PK/FK→Elements.
- SupplierOffers: SupplierId+MaterialId PK y FKs→subtipos; UnitPrice DECIMAL(18,2)>=0, CurrencyCode COP, IsDemo, Version.
- ProductRequirements: MaterialId+ProductId PK y FKs→subtipos; Quantity DECIMAL(18,4)>0, IsDemo, Version.
- GeneralDependencies: SourceId+TargetId PK y FKs→Elements, Version.
- Roles: RoleId PK (Administrator,Editor,Viewer).
- Users: UUID UserId PK; Username único, DisplayName, Email, PasswordHash, RoleId FK, IsActive, Version, CreatedAt.
- Sessions: TokenHash PK SHA256 de token aleatorio, UserId FK, CsrfToken, ExpiresAt.
- Migrations: MigrationId PK, SourceHash y AppliedAt.

El DDL ejecutable está en backend/Schema.py. CREATE TABLE es idempotente; no se utiliza CREATE OR REPLACE ni se borran tablas.
MariaDB confirma DDL implícitamente: la creación del esquema y la transacción de importación son etapas separadas. Una importación parcial se revierte, aunque el esquema vacío puede permanecer.
Las altas de elementos insertan base y subtipo en una transacción. Las bajas eliminan relaciones, subtipo y elemento de forma atómica. Los IDs y tipos son estables.


RevisionClock: tabla técnica añadida durante revisión; ClockId PK=1 y CurrentValue BIGINT. El contador persistente asigna versiones no repetidas, incluso después de borrar y recrear IDs. Todas las mutaciones del catálogo adquieren primero su bloqueo. El contador y los datos se confirman/revierten juntos. Las columnas Version del catálogo son BIGINT dentro del rango entero exacto de JavaScript.
