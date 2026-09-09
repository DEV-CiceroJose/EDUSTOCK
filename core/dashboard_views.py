from datetime import date

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from plataforma.authentication import TokenAcessoAuthentication
from plataforma.permissions import escola_do_request

from .dashboard import montar_dashboard_operacional


class DashboardOperacionalView(APIView):
    authentication_classes = [TokenAcessoAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        valor_data = request.query_params.get("data")
        try:
            data = date.fromisoformat(valor_data) if valor_data else timezone.localdate()
        except ValueError:
            return Response(
                {"detail": "Data inválida. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        escola = escola_do_request(request)
        if escola is None:
            return Response(
                {"detail": "Nenhuma escola autorizada para este usuário."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(montar_dashboard_operacional(escola=escola, data=data, user=request.user))
