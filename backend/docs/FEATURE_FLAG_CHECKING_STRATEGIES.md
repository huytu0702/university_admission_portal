# So Sánh: Feature Flag Checking Strategies

## ❓ Câu Hỏi

**"Tưởng là trong các design pattern đã có check bật hay chưa rồi cơ mà, sao lại cần check thêm cả ở trong `applications.service.ts` nữa?"**

## ✅ Có 2 Cách Tiếp Cận

### **Strategy 1: Check ở Infrastructure Layer (Services)** ⭐ RECOMMENDED

Feature flags được check **bên trong** các pattern services.

#### Ưu Điểm ✅
- **Single Responsibility**: Pattern service tự quản lý việc bật/tắt
- **DRY Principle**: Không duplicate code check flags
- **Cleaner Business Logic**: `ApplicationsService` chỉ focus vào business logic
- **Encapsulation**: Feature flag logic được ẩn đi
- **Easier to maintain**: Chỉ thay đổi ở một chỗ

#### Nhược Điểm ❌
- Khó kiểm soát toàn bộ flow từ business layer
- Không thể có custom behavior cho từng use case

---

### **Strategy 2: Check ở Business Layer (ApplicationsService)** ⚠️ CURRENT

Feature flags được check **ở ApplicationsService** trước khi gọi pattern services.

#### Ưu Điểm ✅
- **Explicit Control**: Rõ ràng về việc pattern nào được dùng
- **Custom Fallback**: Có thể customize behavior cho từng use case
- **Clear Flow**: Dễ hiểu luồng xử lý từ đầu đến cuối

#### Nhược Điểm ❌  
- **Duplicate Checks**: Check lại điều mà service đã check
- **Tight Coupling**: Business logic phụ thuộc vào feature flags
- **Violation of SRP**: ApplicationsService biết quá nhiều về infrastructure
- **Hard to maintain**: Thay đổi feature flag logic ở nhiều chỗ

---

## 🔍 So Sánh Cụ Thể

### Hiện Tại Các Services ĐÃ Check Feature Flags

#### 1. **IdempotencyService** 
```typescript
// File: feature-flags/idempotency/idempotency.service.ts
async executeWithIdempotency<T>(
  idempotencyKey: string | undefined,
  operation: () => Promise<T>
): Promise<T> {
  if (!idempotencyKey) {
    return await operation();
  }

  // ✅ CHECK FLAG BÊN TRONG
  const flag = await this.featureFlagsService.getFlag('idempotency-key');
  if (!flag || !flag.enabled) {
    // Feature disabled → execute directly
    return await operation();
  }

  // Feature enabled → use idempotency logic
  // ...
}
```

#### 2. **QueueProducerService**
```typescript
// File: feature-flags/queue/queue-producer.service.ts
async addVerifyDocumentJob(jobId: string, data: any): Promise<void> {
  // ✅ CHECK FLAG BÊN TRONG
  const flag = await this.featureFlagsService.getFlag('bulkhead-isolation');
  
  if (flag && flag.enabled) {
    // Use bulkhead isolation
    await this.bulkheadService.executeInBulkhead('verify_document', async () => {
      await this.verifyDocumentQueue.add(...);
    });
  } else {
    // Execute without bulkhead
    await this.verifyDocumentQueue.add(...);
  }
}
```

#### 3. **ApplicationReadService**
```typescript
// File: read-model/application-read.service.ts
private async getFlags(): Promise<[boolean, boolean]> {
  // ✅ CHECK FLAGS BÊN TRONG
  const cacheFlag = await this.featureFlagsService.getFlag('cache-aside');
  const viewFlag = await this.featureFlagsService.getFlag('cqrs-lite');
  return [cacheFlag?.enabled ?? false, viewFlag?.enabled ?? false];
}

async listForUser(userId: string): Promise<ApplicationView[]> {
  const [useCache, useView] = await this.getFlags();
  // Use flags internally
  // ...
}
```

---

## 🎯 Recommendation: Sử Dụng Strategy 1

Nên **XÓA BỎ** việc check feature flags ở `ApplicationsService` và để các pattern services tự handle.

### Trước (Duplicate Checks) ❌

```typescript
// ApplicationsService
async createApplication(userId: string, dto: CreateApplicationDto, idempotencyKey?: string) {
  // ❌ CHECK Ở ĐÂY (Duplicate)
  const idempotencyFlag = await this.featureFlagsService.getFlag('idempotency');
  const isIdempotencyEnabled = idempotencyFlag?.enabled ?? true;

  if (isIdempotencyEnabled && idempotencyKey) {
    // IdempotencyService cũng sẽ check lại flag bên trong!
    return await this.idempotencyService.executeWithIdempotency(...);
  } else {
    return await this.createApplicationInternal(...);
  }
}
```

### Sau (Single Check) ✅

```typescript
// ApplicationsService
async createApplication(userId: string, dto: CreateApplicationDto, idempotencyKey?: string) {
  // ✅ Không cần check - để IdempotencyService handle
  return await this.idempotencyService.executeWithIdempotency(
    idempotencyKey,
    async () => this.createApplicationInternal(userId, dto)
  );
}

// IdempotencyService tự check flag bên trong
async executeWithIdempotency<T>(key, operation) {
  if (!key) return await operation();
  
  const flag = await this.featureFlagsService.getFlag('idempotency-key');
  if (!flag?.enabled) {
    return await operation(); // Auto fallback
  }
  
  // Use idempotency
  // ...
}
```

---

## 📊 So Sánh Chi Tiết

| Aspect | Strategy 1 (Services Check) | Strategy 2 (Business Check) |
|--------|----------------------------|---------------------------|
| **Separation of Concerns** | ✅ Good | ❌ Poor |
| **DRY Principle** | ✅ No duplication | ❌ Duplicate checks |
| **Maintainability** | ✅ Easy | ❌ Hard |
| **Testability** | ✅ Test in service layer | ❌ Test at multiple layers |
| **Flexibility** | ⚠️ Less control | ✅ Full control |
| **Code Clarity** | ✅ Clean business logic | ❌ Mixed concerns |
| **Coupling** | ✅ Loose | ❌ Tight |

---

## 🛠️ Cải Thiện Code

### Outbox Pattern

#### Hiện Tại (ApplicationsService) ❌
```typescript
// Check flag ở business layer
const outboxFlag = await this.featureFlagsService.getFlag('outbox_pattern');
const isOutboxEnabled = outboxFlag?.enabled ?? true;

if (isOutboxEnabled) {
  // Create outbox events
  await tx.outbox.create({...});
} else {
  // Synchronous processing
  await this.processSynchronously(...);
}
```

#### Nên Làm (Create OutboxService) ✅
```typescript
// OutboxService tự check flag bên trong
@Injectable()
export class OutboxService {
  async createEvent(eventType: string, payload: any, tx: any) {
    // Check flag internally
    const flag = await this.featureFlagsService.getFlag('outbox_pattern');
    
    if (flag?.enabled) {
      // Create outbox event
      await tx.outbox.create({
        data: { eventType, payload: JSON.stringify(payload) }
      });
    } else {
      // Auto trigger synchronous processing
      await this.processSynchronously(eventType, payload);
    }
  }
}

// ApplicationsService chỉ cần gọi
await this.outboxService.createEvent('document_uploaded', {...}, tx);
```

---

## 🎯 Kết Luận

### Nên Làm ✅

1. **XÓA** các check feature flags ở `ApplicationsService`
2. **ĐỂ** các pattern services tự check flags bên trong
3. **LUÔN GỌI** pattern services, chúng sẽ tự fallback nếu disabled
4. **TẬP TRUNG** business logic vào ApplicationsService

### Code Mẫu Đơn Giản

```typescript
@Injectable()
export class ApplicationsService {
  async createApplication(userId: string, dto: CreateApplicationDto, idempotencyKey?: string) {
    // Đơn giản - không check flags!
    return await this.idempotencyService.executeWithIdempotency(
      idempotencyKey,
      async () => {
        const user = await this.prisma.user.findUnique({...});
        const validatedFiles = await this.validateAndStoreFiles(dto.files);
        
        const application = await this.prisma.$transaction(async (tx) => {
          const newApp = await tx.application.create({...});
          
          // OutboxService tự check flag
          await this.outboxService.createEvent('document_uploaded', {...}, tx);
          
          return newApp;
        });
        
        // ReadService tự check flag
        await this.applicationReadService.refresh(application.id);
        
        return {
          applicationId: application.id,
          statusUrl: `/applications/${application.id}/status`,
        };
      }
    );
  }
}
```

**Clean, Simple, Maintainable!** ✨

---

**Version:** 1.0.0  
**Last Updated:** 2025-12-04
