# Juiz urbano — ruas, calçadas, fachadas e câmera
O juiz de layout confere cada setor ao terminar a geração procedural.
**Ruas:** remover pilares, postes, lixeiras, bancos e objetos colocados dentro do asfalto.
**Calçadas:** preservar faixa de circulação; árvores, canteiros e bancos maiores somente na faixa verde fora do passeio.
**Fachadas:** a frente das casas, lojas e hotéis deve apontar para a via; recuos de edifícios urbanos e casas foram reduzidos.
**Câmera:** Q/E continuam girando, botão do meio horizontal gira e vertical inclina; Page Up / Page Down regulam inclinação entre 0.34 e 0.84. A câmera dos carros WebGL acompanha a inclinação.
**Faixas:** marcações duplicadas a menos de 12 m são filtradas no gerador.
**Resultado:** em runtime, S.layoutAudit e OW.stats.layout expõem quantidades de falhas detectadas e até 12 exemplos.
**Teste automatizado:** `node --test tests/street-layout.test.cjs`.
A avaliação geométrica não substitui o teste visual em cruzamentos, quatro orientações da câmera e setores recarregados.
