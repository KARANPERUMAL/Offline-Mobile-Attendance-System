# ================================
# Dockerfile for Spring Boot Backend
# Multi-stage build: Build → Slim Runtime
# ================================

# --- Stage 1: Build ---
FROM maven:3.9.6-eclipse-temurin-17 AS builder
WORKDIR /app

# Copy pom.xml first (leverage Docker cache for dependency downloads)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source and build
COPY src ./src
RUN mvn clean package -DskipTests -B

# --- Stage 2: Runtime ---
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Add non-root user for security
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Copy the built jar from builder stage
COPY --from=builder /app/target/attendance-system-1.0.0.jar app.jar

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/auth/health || exit 1

# Run the application
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
