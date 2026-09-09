from django.urls import path
from .views import AlunosView, AlunoDetailView, ModeloView, ImportacaoView, RodadasView, EstadoView, RelatorioView, OperacaoEntregasView

urlpatterns = [
    path('alunos/', AlunosView.as_view()),
    path('alunos/<int:pk>/', AlunoDetailView.as_view()),
    path('modelo/', ModeloView.as_view()),
    path('importacao/', ImportacaoView.as_view()),
    path('rodadas/', RodadasView.as_view()),
    path('rodadas/<int:pk>/estado/', EstadoView.as_view()),
    path('relatorio/', RelatorioView.as_view()),
    path('operacao/', OperacaoEntregasView.as_view()),
]
