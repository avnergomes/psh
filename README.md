# PSH Microbacias - Visualizador de Dados Geoespaciais

Sistema de visualização web para análise integrada de dados geoespaciais das microbacias do PSH.

## 📊 Sobre

Este projeto é uma adaptação do sistema Água Segura para visualizar e analisar dados das microbacias do PSH (Programa de Saneamento Hídrico). O sistema permite visualizar diversas camadas temáticas com filtro por microbacias.

## 🗺️ Camadas Disponíveis

### Camadas Básicas
- **Microbacias Selecionadas** - Limite das microbacias do projeto
- **Altimetria** - Classes de altitude
- **Declividade** - Classes de declividade em percentual
- **Curvas de Nível** - Linhas de elevação
- **Estradas** - Malha viária

### Recursos Hídricos
- **Hidrografia** - Rede hidrográfica
- **Nascentes** - Pontos de nascentes

### Uso e Ocupação
- **Uso do Solo** - Classes de uso e cobertura do solo (MapBiomas)
- **Solos** - Tipos de solo
- **Conflitos de Uso em APP** - Áreas com conflito de uso em APP
- **Construções** - Edificações
- **Imóveis CAR** - Cadastro Ambiental Rural

### Equipamentos e Serviços
- **Educação** - Equipamentos de educação
- **SIGARH** - Usos de água registrados
- **CAF** - Cadastro de Atividades Florestais

### Pecuária
- **Estabelecimentos com Aves**
- **Estabelecimentos com Bovinos**
- **Estabelecimentos com Bubalinos**
- **Estabelecimentos com Suínos**

### Agrotóxicos
- **Registros de Agrotóxicos** - Uso de agrotóxicos (ADAPAR)
- **Receituários Agronômicos** - Receituários emitidos

## 🚀 Como Usar

### Requisitos
- Navegador moderno (Chrome, Firefox, Edge, Safari)
- Servidor web local (ex: Python http.server, Live Server do VS Code)

### Setup

1. Clone o repositório:
```bash
git clone https://github.com/avnergomes/psh-mapa.git
cd psh-mapa
```

2. Crie um link simbólico para a pasta de dados do PSH:

**Windows (PowerShell como Administrador):**
```powershell
New-Item -ItemType SymbolicLink -Path "data" -Target "..\psh\data"
```

**Linux/Mac:**
```bash
ln -s ../psh/data data
```

3. Inicie um servidor web local:

**Python 3:**
```bash
python -m http.server 8000
```

**Node.js (http-server):**
```bash
npx http-server -p 8000
```

**VS Code:**
Use a extensão "Live Server"

4. Abra no navegador:
```
http://localhost:8000
```

## 🎛️ Funcionalidades

### Filtro por Microbacias
- Selecione microbacias específicas para análise
- Busca por código, nome ou manancial
- Botões "Selecionar todas" e "Limpar seleção"

### Controles de Visualização
- **Ajustar visão** - Enquadra todas as camadas visíveis
- **Controle de opacidade** - Ajusta a transparência das camadas
- **Seletor de base** - Escolha o mapa base (CARTO Light, OSM, Esri Imagery, etc.)

### Legenda Dinâmica
- Atualiza automaticamente conforme camadas ativadas
- Exibe estatísticas por classe (área, extensão, quantidade)
- Percentuais relativos

### Popups Informativos
- Clique nas feições para ver seus atributos
- Até 12 atributos exibidos por feição

## 🛠️ Tecnologias

- **Leaflet** 1.9.4 - Biblioteca de mapas
- **Pako** 2.1.0 - Descompactação gzip
- **Turf.js** 6.5.0 - Análise espacial
- **Vanilla JavaScript** - Sem frameworks pesados

## 📐 Padrões de Dados

### Sistema de Referência
- **Armazenamento:** EPSG:4674 (SIRGAS 2000 lat/long)
- **Análise:** EPSG:31982 (UTM 22S) ou EPSG:31983 (UTM 23S)

### Formato
- GeoJSON compactado (.geojson.gz)
- Arquivos particionados para otimização

### Campos Padrão
- `Cod_man` - Código da microbacia
- `Nome_bacia` - Nome da microbacia
- `Manancial` - Nome do manancial
- `Classe` - Classificação

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto é uma adaptação do sistema Água Segura desenvolvido pelo IDR-Paraná.

## 👤 Autor

**Avner Paes Gomes**
- Email: avner@idr.pr.gov.br
- GitHub: [@avnergomes](https://github.com/avnergomes)

## 📧 Contato / Suporte

Para questões sobre os dados ou uso do sistema, entre em contato com a equipe técnica do PSH.

---

**Versão:** 1.0  
**Última atualização:** Novembro 2025
