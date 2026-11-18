FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY backend/ ./
RUN ./gradlew --no-daemon test bootJar

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN groupadd --gid 10001 dotodo && useradd --uid 10001 --gid dotodo --no-create-home dotodo
COPY --from=build /app/build/libs/*-SNAPSHOT.jar /app/dotodo.jar
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/dotodo.jar"]
