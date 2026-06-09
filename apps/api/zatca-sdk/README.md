# ZATCA SDK JAR

Place the official **ZATCA Compliance & Enablement Toolbox SDK** fat-jar here and
name it `zatca-einvoicing-sdk.jar` (or update `ZATCA_SDK_JAR`).

How to obtain it (see the SDK User Manual):
1. ZATCA website → **Systems Developers** → **Compliance and Enablement Toolbox**,
   or the Fatoora **Developer Portal** → Download SDK → accept terms → **Download JAR**.
2. Unzip the downloaded `sdk.zip`.
3. From `Apps/`, copy the `cli-*-jar-with-dependencies.jar` here and rename it to
   `zatca-einvoicing-sdk.jar`.

The Docker image installs JDK 11 + openssl automatically. This jar is **not**
committed to the repo (it is licensed by ZATCA) — `.gitignore` excludes `*.jar`.

Verify after placing it:

```bash
java -jar zatca-einvoicing-sdk.jar --help
```
