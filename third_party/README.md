# Pacotes de terceiros para o build (não publicados diretamente)

Para instalar os 21 penteados da coleção Vincent Freelance no CAS somente cabelos:

1. Baixe do chat o arquivo cityofgod_21_cabelos_glb.zip, criado a partir do GLB original fornecido pelo autor do City of God.
2. Neste diretório third_party/, clique em Add file > Upload files no GitHub, selecione o ZIP sem extrair, e grave o commit na branch feature/cas-21-hairstyles.
3. O npm run build:site executa tools/install-cas-hair-archive.mjs antes de compilar. O instalador verifica 21 GLBs reais e seus nomes, e extrai os arquivos para assets/characters/hair/ durante o build.
4. Confira a prévia Vercel com os 21 penteados e a documentação de atribuição em docs/CAS-21-HAIRSTYLES.md.

O ZIP não pode ser substituído pelo arquivo GLB original de 31 MB. Use o pacote separado de 21 arquivos entregue nesta conversa.

Autoria da coleção 3D: Vincent Freelance, Sketchfab — FREE 21 Realtime Man Hairstyles Collection. Preserve a atribuição e valide as condições de licença antes de publicar. Os binários de terceiros só devem ser adicionados se houver direito de distribuição.
