# TODO

- fare un readme professionale (fornirò in seguito gli screenshots necessari che mi chiederai, ma intanto prepara una versione base con i contenuti che hai già e usa placeholder per i contenuti che mancano). deve essere una versione già pronta per essere rilasciata
- decidere se tenere activity log nella pagine dei settings o meno (è sicuro? potrebbe leakare qualche sensitive info?, eventualmente eliminare solo i possibili log pericolosi)
- valutare submission duplicate (forse è gia gestito, bisogna verificare)
- gestire meglio la parte del branch nei settings (ora è un semplice input text, dovrebbe essere qualcosa di più strutturato, magari un dropdown con le branch disponibili e quella predefinita selezionata e la possibilità di creare una nuova branch)
- capire se capture preview è obbligatorio da premere per l'utente o se si può automatizzare per rendere più fluido l'esperienza (forse è gia ridondante)
- il sistema di login al momento non è ultimato, bisogna prendere decisioni effettive su come gestire il login considerando che deve essere production ready
- l'input del threshold deve essere un numero tra 0 e 100, non deve essere possibile inserire un valore fuori da questo range. può essere reso uno slider per rendere più facile l'interazione dell'utente
- al momento non c'è nessun tipo di feedback visivo per l'utente a parte nel popup e nei settings. dovremmo aggiungere qualche tipo di alert o notifica per indicare all'utente che sta succedendo qualcosa?  oppure è sufficiente quello che c'è? ragioniamo sulla migliore UX per l'utente
- l'activity log nei settings si resetta? se non lo fa già automaticamente è necessario forse aggiungere un pulsante clear per l'utente?

## TODO NEXT

- fare il commit solo se lo score è maggiore del precedente?
- clear activity log il pulsante va spostato
- nella pagina dei log sarebbe meglio avere degli alert/sonner invece che i "badge"
- rimuovere contorno dai loghi (photopea?)
- fare controllo codice superfluo
