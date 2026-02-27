#!/bin/sh

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
ORANGE='\033[0;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$(id -u)" != "0" ]; then
    printf "${YELLOW}This script requires root privileges. Re-running with sudo...${NC}\n"
    exec sudo sh "$0" "$@"
fi

# Banner
printf "${ORANGE}\n"
cat << 'EOF'
   ____                   _    _      _   _______                  
  / __ \                 | |  | |    | | |__   __|               
 | |  | |_ __   ___ _ __ | |  | | ___| |__  | |_ __ __ _  ___| | __
 | |  | | '_ \ / _ \ '_ \| |/\| |/ _ \ '_ \ | | '__/ _` |/ __| |/ /
 | |__| | |_) |  __/ | | \  /\  /  __/ |_) || | | | (_| | (__|   < 
  \____/| .__/ \___|_| |_|\/  \/ \___|_.__/ |_|_|  \__,_|\___|_|\_\
        | |                                                        
        |_|                                                        
EOF
printf "${NC}\n"
printf "${ORANGE}Welcome to the OpenWebTrack Installer!${NC}\n"
printf "\n"

# Function to generate secrets
generate_secret() {
    length=$1
    if command -v openssl > /dev/null 2>&1; then
        openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c "$length"
    else
        # Fallback to /dev/urandom
        cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c "$length"
    fi
}

# Check for Docker
if ! command -v docker > /dev/null 2>&1; then
    printf "${RED}Error: Docker is not installed.${NC}\n"
    printf "Please install Docker and Docker Compose before running this script.\n"
    printf "Visit https://docs.docker.com/get-docker/ for instructions.\n"
    exit 1
fi

# Set installation directory
DEFAULT_DIR="openwebtrack"
printf "Where would you like to install OpenWebTrack? (Default: ./${DEFAULT_DIR})\n> "
read USER_DIR
INSTALL_DIR=${USER_DIR:-$DEFAULT_DIR}

if [ -d "$INSTALL_DIR" ]; then
    printf "${YELLOW}Directory '$INSTALL_DIR' already exists.${NC}\n"
    printf "Do you want to continue? potentially overwriting files? (y/N) "
    read REPLY
    case "$REPLY" in
        [yY]*) ;;
        *)
            printf "Installation aborted.\n"
            exit 1
            ;;
    esac
fi

# Create directories
printf "${GREEN}Creating directories...${NC}\n"
mkdir -p "$INSTALL_DIR"

# Generate Secrets
printf "${GREEN}Generating secure credentials...${NC}\n"
DB_PASSWORD=$(generate_secret 24)
AUTH_SECRET=$(generate_secret 32)
CRON_SECRET=$(generate_secret 32)

# Email configuration
printf "\n${GREEN}Email Provider Configuration${NC}\n"
printf "Choose your email provider:\n"
printf "  1) Resend\n"
printf "  2) Maileroo\n"
printf "  3) SMTP\n"
printf "  4) Enable later\n"
printf "> "
read EMAIL_PROVIDER

case "$EMAIL_PROVIDER" in
    1)
        printf "Enter your Resend API Key: "
        read RESEND_API_KEY
        printf "Sender Email: "
        read SENDER_EMAIL
        EMAIL_ENV="
            - RESEND_API_KEY=${RESEND_API_KEY}
            - SENDER_EMAIL=${SENDER_EMAIL}"
        ;;
    2)
        printf "Enter your Maileroo API Key: "
        read MAILEROO_API_KEY
        printf "Sender Email: "
        read SENDER_EMAIL
        EMAIL_ENV="
            - MAILEROO_API_KEY=${MAILEROO_API_KEY}
            - SENDER_EMAIL=${SENDER_EMAIL}"
        ;;
    3)
        printf "SMTP Host: "
        read SMTP_HOST
        printf "SMTP Port: "
        read SMTP_PORT
        printf "SMTP User: "
        read SMTP_USER
        printf "SMTP Password: "
        read SMTP_PASS
        printf "Sender Email: "
        read SENDER_EMAIL
        EMAIL_ENV="
            - SMTP_HOST=${SMTP_HOST}
            - SMTP_PORT=${SMTP_PORT}
            - SMTP_USER=${SMTP_USER}
            - SMTP_PASS=${SMTP_PASS}
            - SENDER_EMAIL=${SENDER_EMAIL}"
        ;;
    4|*)
        printf "${YELLOW}Email provider configuration skipped. You can configure it later in $INSTALL_DIR/compose.yml.${NC}\n"
        ;;
esac

# Create compose.yml
printf "${GREEN}Creating compose.yml...${NC}\n"

cat > "$INSTALL_DIR/compose.yml" <<EOL
services:
    app:
        image: ghcr.io/openwebtrack/openwebtrack:latest
        container_name: openwebtrack
        restart: unless-stopped
        ports:
            - 8424:8424
        environment:
            - DATABASE_URL=postgres://postgres:${DB_PASSWORD}@db:5432/openwebtrack
            - ORIGIN=http://localhost:8424
            - AUTH_SECRET=${AUTH_SECRET}
            - CRON_SECRET=${CRON_SECRET}
            - DISABLE_REGISTER=false${EMAIL_ENV}
        depends_on:
            - db

    db:
        image: postgres:17-alpine
        container_name: openwebtrack-db
        restart: unless-stopped
        ports:
            - 5432:5432
        environment:
            - POSTGRES_USER=postgres
            - POSTGRES_PASSWORD=${DB_PASSWORD}
            - POSTGRES_DB=openwebtrack
        volumes:
            - postgres_data:/var/lib/postgresql/data

    cron:
        image: alpine:latest
        command: >
            sh -c "echo '0 9 * * 1 curl -s -H \"x-cron-secret: ${CRON_SECRET}\" http://app:8424/api/cron/weekly-summary' > /etc/crontabs/root && crond -f -L /dev/stdout"
        depends_on:
            - app
volumes:
    postgres_data:
EOL

printf "${GREEN}Installation setup complete!${NC}\n"
printf "\n"

# Prompt to start services
printf "${GREEN}Starting OpenWebTrack...${NC}\n"
    cd "$INSTALL_DIR" || exit 1
    
# Try docker compose first, fallback to docker-compose if needed
if command -v docker > /dev/null 2>&1 && docker compose version > /dev/null 2>&1; then
    DOCKER_CMD="docker compose"
elif command -v docker-compose > /dev/null 2>&1; then
    DOCKER_CMD="docker-compose"
else
    printf "${RED}Error: Could not find 'docker compose' or 'docker-compose'.${NC}\n"
    exit 1
fi

if $DOCKER_CMD up -d; then
    printf "\n"
    printf "${GREEN}OpenWebTrack is running!${NC}\n"
    printf "Access it at: ${ORANGE}http://localhost:8424${NC}\n"
    printf "${YELLOW}[WARNING]After creating your account it is recommended to disable registration by setting DISABLE_REGISTER=true in $INSTALL_DIR/compose.yml${NC}\n"
    printf "\n"
else
    printf "${RED}Failed to start OpenWebTrack.${NC}\n"
    printf "Please check the error messages above.\n"
fi
